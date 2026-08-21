defmodule ChatService.TrustSafety do
  @moduledoc """
  Canonical chat block and report rules.

  A block only prevents new one-to-one contact. It does not erase either
  participant's existing room history and it does not suppress shared group
  rooms. Report records are append-only at this boundary.
  """

  alias ChatService.{DmRoom, MessageId, Repo}

  @report_reasons ~w(
    spam
    scam
    harassment
    hate_speech
    sexual_content
    violence
    impersonation
    privacy
    other
  )
  @max_room_id_bytes 256
  @max_details_bytes 4_000
  @max_details_characters 1_000

  @type storage_error :: {:error, :storage_unavailable}

  @spec report_reasons() :: [String.t()]
  def report_reasons, do: @report_reasons

  @spec normalize_room_id(term()) :: {:ok, String.t()} | {:error, :invalid_room_id}
  def normalize_room_id(value) when is_binary(value) do
    room_id = String.trim(value)

    if room_id != "" and String.valid?(room_id) and byte_size(room_id) <= @max_room_id_bytes and
         not Regex.match?(~r/[\x00-\x1f\x7f]/u, room_id) do
      {:ok, room_id}
    else
      {:error, :invalid_room_id}
    end
  end

  def normalize_room_id(_value), do: {:error, :invalid_room_id}

  @spec normalize_report(term()) ::
          {:ok, %{reason: String.t(), details: String.t(), message_id: String.t() | nil}}
          | {:error, :invalid_reason | :invalid_details | :invalid_message_id}
  def normalize_report(params) when is_map(params) do
    with {:ok, reason} <- normalize_reason(Map.get(params, "reason") || Map.get(params, :reason)),
         {:ok, details} <-
           normalize_details(Map.get(params, "details") || Map.get(params, :details)),
         {:ok, message_id} <-
           normalize_message_id(Map.get(params, "message_id") || Map.get(params, :message_id)) do
      {:ok, %{reason: reason, details: details, message_id: message_id}}
    end
  end

  def normalize_report(_params), do: {:error, :invalid_reason}

  @spec member?(String.t(), binary()) :: {:ok, boolean()} | storage_error()
  def member?(room_id, user_id_bin) when is_binary(room_id) and is_binary(user_id_bin) do
    case Repo.execute(
           "SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
           [{"text", room_id}, {"uuid", user_id_bin}]
         ) do
      {:ok, rows} -> {:ok, Enum.any?(rows)}
      {:error, _reason} -> {:error, :storage_unavailable}
    end
  end

  @spec block_user(binary(), binary()) :: :ok | storage_error()
  def block_user(blocker_id_bin, blocked_id_bin)
      when is_binary(blocker_id_bin) and is_binary(blocked_id_bin) do
    now = DateTime.utc_now()

    Repo.execute(
      """
      INSERT INTO user_blocks (blocker_id, blocked_id, created_at)
      VALUES (?, ?, ?)
      IF NOT EXISTS
      """,
      [
        {"uuid", blocker_id_bin},
        {"uuid", blocked_id_bin},
        {"timestamp", now}
      ]
    )
    |> normalize_write_result()
  end

  @spec unblock_user(binary(), binary()) :: :ok | storage_error()
  def unblock_user(blocker_id_bin, blocked_id_bin)
      when is_binary(blocker_id_bin) and is_binary(blocked_id_bin) do
    Repo.execute(
      "DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?",
      [{"uuid", blocker_id_bin}, {"uuid", blocked_id_bin}]
    )
    |> normalize_write_result()
  end

  @spec blocked_by?(binary(), binary()) :: {:ok, boolean()} | storage_error()
  def blocked_by?(blocker_id_bin, blocked_id_bin)
      when is_binary(blocker_id_bin) and is_binary(blocked_id_bin) do
    case Repo.execute(
           "SELECT blocked_id FROM user_blocks WHERE blocker_id = ? AND blocked_id = ? LIMIT 1",
           [{"uuid", blocker_id_bin}, {"uuid", blocked_id_bin}]
         ) do
      {:ok, rows} -> {:ok, Enum.any?(rows)}
      {:error, _reason} -> {:error, :storage_unavailable}
    end
  end

  @doc "Returns a direction-neutral result so callers never reveal who blocked whom."
  @spec ensure_not_blocked(binary(), binary()) ::
          :ok | {:error, :blocked | :storage_unavailable}
  def ensure_not_blocked(first_user_id_bin, second_user_id_bin)
      when is_binary(first_user_id_bin) and is_binary(second_user_id_bin) do
    with {:ok, first_blocks_second?} <- blocked_by?(first_user_id_bin, second_user_id_bin),
         false <- first_blocks_second?,
         {:ok, second_blocks_first?} <- blocked_by?(second_user_id_bin, first_user_id_bin),
         false <- second_blocks_first? do
      :ok
    else
      true -> {:error, :blocked}
      {:error, :storage_unavailable} = error -> error
    end
  end

  @doc """
  Enforces block state for deterministic DM rooms. Group and support rooms keep
  their shared-room semantics; membership authorization remains a separate
  prerequisite at the controller/channel boundary.
  """
  @spec ensure_room_send_allowed(String.t(), binary()) ::
          :ok | {:error, :blocked | :storage_unavailable}
  def ensure_room_send_allowed(room_id, sender_id_bin)
      when is_binary(room_id) and is_binary(sender_id_bin) do
    case DmRoom.peer_user_id_bin(room_id, sender_id_bin) do
      nil -> :ok
      peer_id_bin -> ensure_not_blocked(sender_id_bin, peer_id_bin)
    end
  end

  @spec create_report(binary(), String.t(), map()) ::
          {:ok, %{report_id: String.t(), status: String.t()}}
          | {:error, :message_not_found | :storage_unavailable}
  def create_report(reporter_id_bin, room_id, %{message_id: message_id} = report)
      when is_binary(reporter_id_bin) and is_binary(room_id) do
    with {:ok, reported_user_id_bin} <- reported_user(room_id, message_id),
         {:ok, result} <- persist_report(reporter_id_bin, room_id, reported_user_id_bin, report) do
      {:ok, result}
    end
  end

  defp normalize_reason(value) when is_binary(value) do
    reason = value |> String.trim() |> String.downcase()
    if reason in @report_reasons, do: {:ok, reason}, else: {:error, :invalid_reason}
  end

  defp normalize_reason(_value), do: {:error, :invalid_reason}

  defp normalize_details(nil), do: {:ok, ""}

  defp normalize_details(value) when is_binary(value) do
    if not String.valid?(value) or byte_size(value) > @max_details_bytes do
      {:error, :invalid_details}
    else
      details = value |> HtmlSanitizeEx.strip_tags() |> String.trim()

      if String.length(details) <= @max_details_characters do
        {:ok, details}
      else
        {:error, :invalid_details}
      end
    end
  end

  defp normalize_details(_value), do: {:error, :invalid_details}

  defp normalize_message_id(nil), do: {:ok, nil}
  defp normalize_message_id(""), do: {:ok, nil}

  defp normalize_message_id(value) when is_binary(value) do
    value = String.trim(value)

    if value == "" do
      {:ok, nil}
    else
      case MessageId.to_string(value) do
        {:ok, canonical_id} -> {:ok, canonical_id}
        :error -> {:error, :invalid_message_id}
      end
    end
  end

  defp normalize_message_id(_value), do: {:error, :invalid_message_id}

  defp reported_user(_room_id, nil), do: {:ok, nil}

  defp reported_user(room_id, message_id) do
    with {:ok, bucket} <- MessageId.bucket(message_id),
         {:ok, message_id_bin} <- MessageId.dump(message_id) do
      case Repo.execute(
             "SELECT sender_id FROM messages WHERE room_id = ? AND bucket = ? AND message_id = ? LIMIT 1",
             [
               {"text", room_id},
               {"int", bucket},
               {"timeuuid", message_id_bin}
             ]
           ) do
        {:ok, rows} ->
          case Enum.take(rows, 1) do
            [%{"sender_id" => sender_id_bin}] when is_binary(sender_id_bin) ->
              {:ok, sender_id_bin}

            _ ->
              {:error, :message_not_found}
          end

        {:error, _reason} ->
          {:error, :storage_unavailable}
      end
    else
      _ -> {:error, :message_not_found}
    end
  end

  defp persist_report(reporter_id_bin, room_id, reported_user_id_bin, report) do
    created_at = DateTime.utc_now()
    report_id = MessageId.generate(created_at)
    {:ok, report_id_bin} = MessageId.dump(report_id)

    {query, params} =
      if report.message_id do
        {:ok, message_id_bin} = MessageId.dump(report.message_id)

        {
          """
          INSERT INTO chat_reports
            (report_id, reporter_id, room_id, message_id, reported_user_id, reason, details, created_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          IF NOT EXISTS
          """,
          [
            {"timeuuid", report_id_bin},
            {"uuid", reporter_id_bin},
            {"text", room_id},
            {"timeuuid", message_id_bin},
            {"uuid", reported_user_id_bin},
            {"text", report.reason},
            {"text", report.details},
            {"timestamp", created_at},
            {"text", "open"}
          ]
        }
      else
        {
          """
          INSERT INTO chat_reports
            (report_id, reporter_id, room_id, reason, details, created_at, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          IF NOT EXISTS
          """,
          [
            {"timeuuid", report_id_bin},
            {"uuid", reporter_id_bin},
            {"text", room_id},
            {"text", report.reason},
            {"text", report.details},
            {"timestamp", created_at},
            {"text", "open"}
          ]
        }
      end

    case Repo.execute(query, params) do
      {:ok, _result} -> {:ok, %{report_id: report_id, status: "open"}}
      {:error, _reason} -> {:error, :storage_unavailable}
    end
  end

  defp normalize_write_result({:ok, _result}), do: :ok
  defp normalize_write_result({:error, _reason}), do: {:error, :storage_unavailable}
end
