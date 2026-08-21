defmodule ChatService.MessagePersistence do
  @moduledoc """
  Persists a chat message behind a caller supplied idempotency key.

  A `(room_id, sender_id, client_ref)` reservation owns one stable timeuuid.
  Retries through Phoenix channels or HTTP therefore converge on the same
  message row. Callers must only publish projections when the returned status
  is `:inserted`.
  """

  alias ChatService.{AttachmentPolicy, MessageId, Repo}

  @max_client_ref_bytes 128
  @client_ref_pattern ~r/\A[A-Za-z0-9][A-Za-z0-9._:-]*\z/

  @type write_status :: :inserted | :duplicate

  @doc """
  Validates a caller supplied idempotency key, or creates one for a legacy
  caller that omitted it.

  Client refs are deliberately opaque and are never interpreted as message
  IDs. Trimming is the only normalization performed before they are stored.
  """
  @spec normalize_client_ref(term()) :: {:ok, String.t()} | {:error, :invalid_client_ref}
  def normalize_client_ref(nil), do: {:ok, Ecto.UUID.generate()}

  def normalize_client_ref(value) when is_binary(value) do
    client_ref = String.trim(value)

    if client_ref != "" and byte_size(client_ref) <= @max_client_ref_bytes and
         Regex.match?(@client_ref_pattern, client_ref) do
      {:ok, client_ref}
    else
      {:error, :invalid_client_ref}
    end
  end

  def normalize_client_ref(_value), do: {:error, :invalid_client_ref}

  @doc """
  Reduces a Scylla/Cassandra LWT result into a safe decision.

  An empty or malformed result is not assumed to have applied. This matters
  because publishing after an ambiguous write could duplicate unread counts.
  """
  @spec reservation_result(term()) :: :applied | {:existing, map()} | :unknown
  def reservation_result(rows) do
    case Enum.to_list(rows) do
      [row | _] when is_map(row) ->
        case fetch_applied(row) do
          {:ok, true} -> :applied
          {:ok, false} -> {:existing, row}
          :error -> :unknown
        end

      _ ->
        :unknown
    end
  rescue
    Protocol.UndefinedError -> :unknown
  end

  @doc """
  Stores one canonical message for the supplied ref.

  The returned message always contains the canonical `message_id`,
  `client_ref`, and `sent_at`. `:duplicate` means the row already existed and
  the caller must not broadcast or increment inbox projections again.
  """
  @spec persist(map()) ::
          {:ok, write_status(), map()}
          | {:error,
             :invalid_attachments
             | :invalid_client_ref
             | :client_ref_conflict
             | :storage_unavailable}
  def persist(attrs) when is_map(attrs) do
    with {:ok, room_id} <- fetch_binary(attrs, :room_id),
         {:ok, sender_id_bin} <- fetch_sender(attrs),
         {:ok, client_ref} <- normalize_client_ref(Map.get(attrs, :client_ref)),
         {:ok, raw_content} <- fetch_binary(attrs, :content),
         {:ok, message_type} <- fetch_binary(attrs, :message_type),
         {:ok, attachments} <-
           AttachmentPolicy.normalize(message_type, Map.get(attrs, :attachments)) do
      content = canonical_content(raw_content)
      payload_hash = payload_hash(content, message_type, attachments)
      candidate = new_reservation(payload_hash)

      with {:ok, reservation} <-
             reserve(room_id, sender_id_bin, client_ref, candidate),
           :ok <- ensure_matching_payload(reservation, payload_hash),
           {:ok, status} <-
             insert_message(
               room_id,
               sender_id_bin,
               content,
               message_type,
               attachments,
               reservation
             ),
           {:ok, message} <-
             canonical_message(
               status,
               room_id,
               sender_id_bin,
               content,
               message_type,
               attachments,
               client_ref,
               reservation
             ) do
        {:ok, status, message}
      end
    else
      {:error, :invalid_client_ref} = error -> error
      {:error, :invalid_attachments} = error -> error
      {:error, :client_ref_conflict} = error -> error
      _ -> {:error, :storage_unavailable}
    end
  end

  def persist(_attrs), do: {:error, :storage_unavailable}

  defp reserve(room_id, sender_id_bin, client_ref, candidate) do
    result =
      Repo.execute(
        """
        INSERT INTO message_client_refs (room_id, sender_id, client_ref, message_id, bucket, sent_at, payload_hash, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        IF NOT EXISTS
        """,
        [
          {"text", room_id},
          {"uuid", sender_id_bin},
          {"text", client_ref},
          {"timeuuid", candidate.message_id_bin},
          {"int", candidate.bucket},
          {"timestamp", candidate.sent_at},
          {"text", candidate.payload_hash},
          {"timestamp", candidate.sent_at}
        ]
      )

    case result do
      {:ok, rows} ->
        case reservation_result(rows) do
          :applied ->
            {:ok, candidate}

          {:existing, row} ->
            reservation_from_row_or_lookup(row, room_id, sender_id_bin, client_ref)

          :unknown ->
            {:error, :storage_unavailable}
        end

      {:error, _reason} ->
        {:error, :storage_unavailable}
    end
  end

  defp reservation_from_row_or_lookup(row, room_id, sender_id_bin, client_ref) do
    case reservation_from_row(row) do
      {:ok, reservation} ->
        {:ok, reservation}

      :error ->
        case Repo.execute(
               """
               SELECT message_id, bucket, sent_at, payload_hash
               FROM message_client_refs
               WHERE room_id = ? AND sender_id = ? AND client_ref = ?
               LIMIT 1
               """,
               [
                 {"text", room_id},
                 {"uuid", sender_id_bin},
                 {"text", client_ref}
               ]
             ) do
          {:ok, rows} ->
            rows
            |> Enum.to_list()
            |> List.first()
            |> reservation_from_row()
            |> case do
              {:ok, reservation} -> {:ok, reservation}
              :error -> {:error, :storage_unavailable}
            end

          {:error, _reason} ->
            {:error, :storage_unavailable}
        end
    end
  end

  defp insert_message(room_id, sender_id_bin, content, message_type, attachments, reservation) do
    result =
      Repo.execute(
        """
        INSERT INTO messages (room_id, bucket, message_id, sender_id, content, message_type, attachments, is_edited, is_deleted, sent_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        IF NOT EXISTS
        """,
        [
          {"text", room_id},
          {"int", reservation.bucket},
          {"timeuuid", reservation.message_id_bin},
          {"uuid", sender_id_bin},
          {"text", content},
          {"text", message_type},
          {"list<text>", attachments},
          {"boolean", false},
          {"boolean", false},
          {"timestamp", reservation.sent_at}
        ]
      )

    case result do
      {:ok, rows} ->
        case reservation_result(rows) do
          :applied -> {:ok, :inserted}
          {:existing, _row} -> {:ok, :duplicate}
          :unknown -> {:error, :storage_unavailable}
        end

      {:error, _reason} ->
        {:error, :storage_unavailable}
    end
  end

  defp canonical_message(
         :inserted,
         room_id,
         sender_id_bin,
         content,
         message_type,
         attachments,
         client_ref,
         reservation
       ) do
    {:ok,
     %{
       room_id: room_id,
       message_id: reservation.message_id,
       client_ref: client_ref,
       sender_id_bin: sender_id_bin,
       content: content,
       message_type: message_type,
       attachments: attachments,
       sent_at: reservation.sent_at
     }}
  end

  defp canonical_message(
         :duplicate,
         room_id,
         _sender_id_bin,
         _content,
         _message_type,
         _attachments,
         client_ref,
         reservation
       ) do
    case Repo.execute(
           """
           SELECT message_id, sender_id, content, message_type, attachments, sent_at
           FROM messages
           WHERE room_id = ? AND bucket = ? AND message_id = ?
           LIMIT 1
           """,
           [
             {"text", room_id},
             {"int", reservation.bucket},
             {"timeuuid", reservation.message_id_bin}
           ]
         ) do
      {:ok, rows} ->
        case rows |> Enum.to_list() |> List.first() do
          row when is_map(row) ->
            {:ok,
             %{
               room_id: room_id,
               message_id: reservation.message_id,
               client_ref: client_ref,
               sender_id_bin: row["sender_id"],
               content: row["content"] || "",
               message_type: row["message_type"] || "text",
               attachments: row["attachments"] || [],
               sent_at: row["sent_at"] || reservation.sent_at
             }}

          _ ->
            {:error, :storage_unavailable}
        end

      {:error, _reason} ->
        {:error, :storage_unavailable}
    end
  end

  defp new_reservation(payload_hash) do
    sent_at = DateTime.utc_now()
    message_id = MessageId.generate(sent_at)
    {:ok, message_id_bin} = MessageId.dump(message_id)

    %{
      message_id: message_id,
      message_id_bin: message_id_bin,
      bucket: Repo.get_bucket(sent_at),
      sent_at: sent_at,
      payload_hash: payload_hash
    }
  end

  defp reservation_from_row(row) when is_map(row) do
    with message_id_bin when is_binary(message_id_bin) <- row["message_id"],
         {:ok, message_id} <- MessageId.to_string(message_id_bin),
         bucket when is_integer(bucket) <- row["bucket"],
         %DateTime{} = sent_at <- row["sent_at"] do
      {:ok,
       %{
         message_id: message_id,
         message_id_bin: message_id_bin,
         bucket: bucket,
         sent_at: sent_at,
         payload_hash: row["payload_hash"]
       }}
    else
      _ -> :error
    end
  end

  defp reservation_from_row(_row), do: :error

  defp ensure_matching_payload(%{payload_hash: nil}, _payload_hash), do: :ok
  defp ensure_matching_payload(%{payload_hash: payload_hash}, payload_hash), do: :ok
  defp ensure_matching_payload(_reservation, _payload_hash), do: {:error, :client_ref_conflict}

  defp payload_hash(content, message_type, attachments) do
    :crypto.hash(
      :sha256,
      Jason.encode!(%{
        "attachments" => attachments,
        "content" => content,
        "message_type" => message_type
      })
    )
    |> Base.encode16(case: :lower)
  end

  # The browser BFF normalizes line endings and control bytes before proxying.
  # Apply the same canonical form to websocket sends so a socket-to-HTTP retry
  # cannot conflict solely because it travelled through a different transport.
  defp canonical_content(content) do
    content
    |> String.replace("\r\n", "\n")
    |> String.replace("\r", "\n")
    |> String.replace(~r/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u, "")
    |> String.trim()
  end

  defp fetch_binary(attrs, key) do
    case Map.fetch(attrs, key) do
      {:ok, value} when is_binary(value) -> {:ok, value}
      _ -> {:error, :storage_unavailable}
    end
  end

  defp fetch_sender(attrs) do
    case Map.fetch(attrs, :sender_id_bin) do
      {:ok, value} when is_binary(value) and byte_size(value) == 16 -> {:ok, value}
      _ -> {:error, :storage_unavailable}
    end
  end

  defp fetch_applied(row) do
    value =
      cond do
        Map.has_key?(row, "[applied]") -> Map.fetch!(row, "[applied]")
        Map.has_key?(row, :"[applied]") -> Map.fetch!(row, :"[applied]")
        true -> :missing
      end

    case value do
      true -> {:ok, true}
      false -> {:ok, false}
      _ -> :error
    end
  end
end
