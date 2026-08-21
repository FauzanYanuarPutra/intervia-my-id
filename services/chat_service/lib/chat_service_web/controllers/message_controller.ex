defmodule ChatServiceWeb.MessageController do
  use ChatServiceWeb, :controller

  alias ChatService.{
    AidaBot,
    AttachmentPolicy,
    HistoryBucket,
    IdentityClient,
    MessageId,
    MessageHistory,
    MessagePersistence,
    Repo,
    TrustSafety,
    UnreadState
  }

  alias ChatService.DmRoom
  alias ChatService.Security
  require Logger

  def index(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    user_id_bin = conn.assigns.current_user_id_bin

    case history_access(room_id, user_id_bin) do
      {:ok, {room_type, joined_at}} ->
        load_history(conn, params, room_id, user_id_bin, room_type, joined_at)

      {:error, :not_member} ->
        conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})

      {:error, _reason} ->
        storage_unavailable(conn)
    end
  end

  defp load_history(conn, params, room_id, user_id_bin, room_type, joined_at) do
    limit =
      params
      |> Map.get("limit", "50")
      |> to_int(50)
      |> min(100)
      |> max(1)

    with {:ok, bucket} <- resolve_history_bucket(params, user_id_bin, room_id),
         {:ok, before_id} <- history_before_id(params),
         {:ok, {query, args}} <-
           MessageHistory.build_query(
             room_id,
             bucket,
             before_id,
             limit,
             room_type,
             joined_at
           ),
         {:ok, rows} <- Repo.execute(query, args) do
      data =
        Enum.map(rows, fn row ->
          %{
            message_id: message_id_string(row["message_id"]),
            sender_id: uuid_to_string(row["sender_id"]),
            content: row["content"],
            message_type: row["message_type"] || "text",
            attachments:
              safe_stored_attachments(
                row["message_type"] || "text",
                row["attachments"] || []
              ),
            is_edited: row["is_edited"] || false,
            is_deleted: row["is_deleted"] || false,
            sent_at: row["sent_at"]
          }
        end)

      room_name = resolve_room_name(room_id, user_id_bin)
      json(conn, %{data: data, room_name: room_name})
    else
      :error ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid history cursor"})

      {:error, :invalid_cursor} ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid history cursor"})

      {:error, :missing_joined_at} ->
        Logger.error("Group history denied because membership joined_at is unavailable")
        storage_unavailable(conn)

      {:error, _reason} ->
        storage_unavailable(conn)
    end
  end

  def create(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    user_id_bin = conn.assigns.current_user_id_bin
    raw_content = params["content"] || conn.body_params["content"] || ""
    client_ref = params["client_ref"] || conn.body_params["client_ref"]

    # Media support: optional type + attachments
    raw_type = params["type"] || conn.body_params["type"] || "text"
    message_type = normalize_message_type(raw_type)

    attachments_result =
      AttachmentPolicy.normalize(
        message_type,
        params["attachments"] || conn.body_params["attachments"]
      )

    attachments =
      case attachments_result do
        {:ok, normalized} -> normalized
        _ -> []
      end

    # Security & Performance: sanitize text content and enforce limits
    content = raw_content |> HtmlSanitizeEx.strip_tags() |> String.trim()
    has_media = attachments != []
    scan_result = if content == "", do: %{action: :allow}, else: Security.scan_content(content)
    client_ref_result = MessagePersistence.normalize_client_ref(client_ref)

    cond do
      attachments_result == {:error, :invalid_attachments} ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid attachments"})

      content == "" and not has_media ->
        conn |> put_status(:bad_request) |> json(%{error: "content or attachment is required"})

      byte_size(content) > 5000 ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "message too long (max 5000 characters)"})

      client_ref_result == {:error, :invalid_client_ref} ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid client_ref"})

      scan_result.action == :block ->
        conn |> put_status(:bad_request) |> json(%{error: "message blocked"})

      true ->
        if not room_member?(room_id, user_id_bin) do
          conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
        else
          with :ok <- TrustSafety.ensure_room_send_allowed(room_id, user_id_bin) do
            {:ok, normalized_client_ref} = client_ref_result

            case MessagePersistence.persist(%{
                   room_id: room_id,
                   sender_id_bin: user_id_bin,
                   client_ref: normalized_client_ref,
                   content: content,
                   message_type: message_type,
                   attachments: attachments
                 }) do
              {:ok, status, message} ->
                payload = %{
                  room_id: room_id,
                  sender_id_bin: user_id_bin,
                  body:
                    if(message.content == "",
                      do: media_fallback_text(message.message_type, message.attachments),
                      else: message.content
                    ),
                  sent_at: message.sent_at
                }

                topic = "room:" <> room_id
                sender_id_str = conn.assigns[:current_user_id] || Ecto.UUID.cast!(user_id_bin)

                socket_payload = %{
                  message_id: message.message_id,
                  client_ref: message.client_ref,
                  sender_id: sender_id_str,
                  body: payload.body,
                  content: message.content,
                  message_type: message.message_type,
                  attachments: message.attachments,
                  sent_at: DateTime.to_iso8601(message.sent_at),
                  deduplicated: status == :duplicate
                }

                if status == :inserted do
                  case update_inbox_and_unread(payload) do
                    :ok ->
                      :ok

                    {:error, reason} ->
                      Logger.error("Inbox projection failed: #{inspect(reason)}")
                  end

                  ChatServiceWeb.Endpoint.broadcast!(topic, "new_message", socket_payload)
                  broadcast_inbox_updated(room_id)

                  maybe_reply_as_aida(%{
                    room_id: room_id,
                    sender_id: sender_id_str,
                    content: message.content,
                    message_type: message.message_type,
                    attachments: message.attachments
                  })
                end

                response_status = if status == :inserted, do: :created, else: :ok

                json(conn |> put_status(response_status), %{
                  data: %{
                    room_id: room_id,
                    message_id: message.message_id,
                    client_ref: message.client_ref,
                    sender_id: conn.assigns[:current_user_id],
                    content: message.content,
                    message_type: message.message_type,
                    attachments: message.attachments,
                    sent_at: DateTime.to_iso8601(message.sent_at),
                    deduplicated: status == :duplicate
                  }
                })

              {:error, :invalid_client_ref} ->
                conn |> put_status(:bad_request) |> json(%{error: "invalid client_ref"})

              {:error, :invalid_attachments} ->
                conn |> put_status(:bad_request) |> json(%{error: "invalid attachments"})

              {:error, :client_ref_conflict} ->
                conn
                |> put_status(:conflict)
                |> json(%{error: "client_ref was already used for another message"})

              {:error, _reason} ->
                storage_unavailable(conn)
            end
          else
            {:error, :blocked} ->
              conn
              |> put_status(:forbidden)
              |> json(%{error: "conversation unavailable", code: "contact_blocked"})

            {:error, :storage_unavailable} ->
              storage_unavailable(conn)
          end
        end
    end
  end

  def read(conn, %{"room_id" => room_id_raw}) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    user_id_bin = conn.assigns.current_user_id_bin

    if not room_member?(room_id, user_id_bin) do
      conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
    else
      case UnreadState.clear(user_id_bin, room_id) do
        :ok ->
          json(conn, %{status: "ok"})

        {:error, reason} ->
          Logger.error("Unread state clear failed: #{inspect(reason)}")
          storage_unavailable(conn)
      end
    end
  end

  defp update_inbox_and_unread(m) do
    with {:ok, members} <- fetch_room_members_result(m.room_id),
         {:ok, {room_type, room_name, room_avatar}} <- fetch_room_meta_result(m.room_id) do
      Enum.reduce_while(members, :ok, fn member_id_bin, :ok ->
        case update_member_inbox(m, member_id_bin, room_type, room_name, room_avatar) do
          :ok -> {:cont, :ok}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
    end
  end

  defp update_member_inbox(m, member_id_bin, room_type, room_name, room_avatar) do
    is_sender = member_id_bin == m.sender_id_bin
    write_timestamp = DateTime.to_unix(m.sent_at, :microsecond)

    inbox_result =
      Repo.execute(
        """
        INSERT INTO user_room_state (user_id, room_id, last_message_at, room_type, room_name, room_avatar, last_message, last_sender, unread_count, is_pinned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        USING TIMESTAMP ?
        """,
        [
          {"uuid", member_id_bin},
          {"text", m.room_id},
          {"timestamp", m.sent_at},
          {"text", room_type},
          {"text", room_name},
          {"text", room_avatar},
          {"text", m.body},
          {"uuid", m.sender_id_bin},
          {"int", if(is_sender, do: 0, else: 1)},
          {"boolean", false},
          {"bigint", write_timestamp}
        ]
      )

    unread_result =
      if is_sender do
        {:ok, :sender}
      else
        Repo.execute(
          "UPDATE unread_counters SET unread = unread + 1 WHERE user_id = ? AND room_id = ?",
          [{"uuid", member_id_bin}, {"text", m.room_id}]
        )
      end

    case {inbox_result, unread_result} do
      {{:ok, _}, {:ok, _}} -> :ok
      {{:error, reason}, _} -> {:error, reason}
      {_, {:error, reason}} -> {:error, reason}
    end
  end

  defp fetch_room_members_result(room_id) do
    case Repo.execute("SELECT user_id FROM room_members WHERE room_id = ?", [{"text", room_id}]) do
      {:ok, rows} ->
        members = rows |> Enum.map(& &1["user_id"]) |> Enum.filter(&is_binary/1)
        {:ok, members}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp fetch_room_members(room_id) do
    case fetch_room_members_result(room_id) do
      {:ok, members} -> members
      {:error, _reason} -> []
    end
  end

  defp fetch_room_meta_result(room_id) do
    case Repo.execute(
           "SELECT room_type, room_name, room_avatar FROM rooms WHERE room_id = ? LIMIT 1",
           [{"text", room_id}]
         ) do
      {:ok, rows} ->
        case Enum.take(rows, 1) do
          [row] ->
            {:ok,
             {
               row["room_type"] || "dm",
               row["room_name"] || room_id,
               row["room_avatar"] || ""
             }}

          [] ->
            {:error, :room_not_found}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp fetch_room_meta(room_id) do
    case fetch_room_meta_result(room_id) do
      {:ok, room_meta} -> room_meta
      {:error, _reason} -> {"dm", room_id, ""}
    end
  end

  defp history_access(room_id, user_id_bin) do
    case Repo.execute(
           "SELECT joined_at FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
           [
             {"text", room_id},
             {"uuid", user_id_bin}
           ]
         ) do
      {:ok, rows} ->
        case Enum.take(rows, 1) do
          [row] ->
            with {:ok, {room_type, _room_name, _room_avatar}} <- fetch_room_meta_result(room_id) do
              {:ok, {room_type, row["joined_at"]}}
            end

          [] ->
            {:error, :not_member}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp history_before_id(params) do
    if Map.has_key?(params, "before") do
      before_id = Map.get(params, "before", "") |> to_string() |> String.trim()

      case MessageId.dump(before_id) do
        {:ok, before_id_bin} -> {:ok, before_id_bin}
        :error -> {:error, :invalid_cursor}
      end
    else
      {:ok, nil}
    end
  end

  defp room_member?(room_id, user_id_bin) do
    case Repo.execute(
           "SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
           [
             {"text", room_id},
             {"uuid", user_id_bin}
           ]
         ) do
      {:ok, rows} -> Enum.any?(rows)
      _ -> false
    end
  end

  defp broadcast_inbox_updated(room_id) do
    members = fetch_room_members(room_id)

    Enum.each(members, fn member_id_bin ->
      topic = "user:" <> Ecto.UUID.cast!(member_id_bin)

      Phoenix.PubSub.broadcast(
        ChatService.PubSub,
        topic,
        %Phoenix.Socket.Broadcast{
          topic: topic,
          event: "inbox_updated",
          payload: %{room_id: room_id}
        }
      )
    end)
  end

  defp resolve_dm_room_name(room_id, user_id_bin) do
    case DmRoom.peer_user_id_bin(room_id, user_id_bin) do
      nil ->
        nil

      peer_id_bin ->
        peer_id = Ecto.UUID.cast!(peer_id_bin)

        case IdentityClient.fetch_public_profile(peer_id) do
          {:ok, profile} ->
            IdentityClient.display_name(profile, peer_id) || peer_id

          _ ->
            case Repo.execute(
                   "SELECT display_name, username FROM users WHERE user_id = ? LIMIT 1",
                   [{"uuid", peer_id_bin}]
                 ) do
              {:ok, rows} ->
                case Enum.take(rows, 1) do
                  [row] -> row["display_name"] || row["username"]
                  [] -> nil
                end

              _ ->
                nil
            end
        end
    end
  end

  defp resolve_room_name(room_id, user_id_bin) do
    {room_type, room_name, _avatar} = fetch_room_meta(room_id)

    case room_type do
      "dm" ->
        resolve_dm_room_name(room_id, user_id_bin) || room_name || room_id

      _ ->
        room_name || room_id
    end
  end

  defp normalize_message_type(type) when is_binary(type) do
    t = String.downcase(String.trim(type))

    if t in [
         "text",
         "image",
         "file",
         "video",
         "audio",
         "location",
         "system",
         "sticker",
         "offer",
         "transaction",
         "application",
         "listing",
         "invite",
         "order",
         "milestone",
         "ride_update",
         "delivery_update",
         "job_update"
       ],
       do: t,
       else: "text"
  end

  defp normalize_message_type(_), do: "text"

  defp safe_stored_attachments(message_type, attachments) do
    case AttachmentPolicy.normalize(message_type, attachments) do
      {:ok, normalized} -> normalized
      {:error, :invalid_attachments} -> []
    end
  end

  defp media_fallback_text("image", [first | _]), do: "Image: " <> first
  defp media_fallback_text("video", [first | _]), do: "Video: " <> first
  defp media_fallback_text("audio", [first | _]), do: "Audio: " <> first
  defp media_fallback_text("file", [first | _]), do: "File: " <> first
  defp media_fallback_text("sticker", _), do: "Sticker"
  defp media_fallback_text("location", [first | _]), do: "Location: " <> first
  defp media_fallback_text("application", _attachments), do: "Application"
  defp media_fallback_text("listing", _attachments), do: "Listing shared"
  defp media_fallback_text("order", _attachments), do: "Order update"
  defp media_fallback_text("milestone", _attachments), do: "Milestone update"
  defp media_fallback_text("ride_update", _attachments), do: "Ride update"
  defp media_fallback_text("delivery_update", _attachments), do: "Delivery update"
  defp media_fallback_text("job_update", _attachments), do: "Job update"
  defp media_fallback_text(_type, _attachments), do: "Attachment"

  defp maybe_reply_as_aida(%{room_id: room_id, sender_id: sender_id} = incoming) do
    if AidaBot.should_reply?(room_id, sender_id) do
      reply_text =
        AidaBot.build_reply(incoming.content || "",
          room_id: room_id,
          message_type: incoming.message_type,
          attachments: incoming.attachments || []
        )

      if String.trim(reply_text) != "" do
        with {:ok, bot_id_bin} <- Ecto.UUID.dump(AidaBot.bot_id()) do
          topic = "room:" <> room_id

          case MessagePersistence.persist(%{
                 room_id: room_id,
                 sender_id_bin: bot_id_bin,
                 client_ref: "aida:" <> Ecto.UUID.generate(),
                 content: reply_text,
                 message_type: "text",
                 attachments: []
               }) do
            {:ok, :inserted, message} ->
              ensure_bot_projection(bot_id_bin, message.sent_at)

              update_inbox_and_unread(%{
                room_id: room_id,
                sender_id_bin: bot_id_bin,
                body: message.content,
                sent_at: message.sent_at
              })

              ChatServiceWeb.Endpoint.broadcast!(topic, "new_message", %{
                message_id: message.message_id,
                client_ref: message.client_ref,
                sender_id: AidaBot.bot_id(),
                body: message.content,
                content: message.content,
                message_type: message.message_type,
                attachments: message.attachments,
                sent_at: DateTime.to_iso8601(message.sent_at)
              })

              broadcast_inbox_updated(room_id)

            {:ok, :duplicate, _message} ->
              :ok

            {:error, reason} ->
              Logger.error("Aida reply persistence failed: #{inspect(reason)}")
          end
        end
      end
    end

    :ok
  end

  defp maybe_reply_as_aida(_), do: :ok

  defp ensure_bot_projection(bot_id_bin, now) do
    Repo.execute(
      """
      INSERT INTO users (user_id, display_name, avatar_url, last_active, updated_at)
      VALUES (?, ?, ?, ?, ?)
      """,
      [
        {"uuid", bot_id_bin},
        {"text", AidaBot.bot_name()},
        {"text", AidaBot.bot_avatar()},
        {"timestamp", now},
        {"timestamp", now}
      ]
    )
  end

  defp uuid_to_string(nil), do: nil

  defp uuid_to_string(bin) when is_binary(bin) do
    case Ecto.UUID.cast(bin) do
      {:ok, str} -> str
      _ -> Base.encode64(bin)
    end
  end

  defp uuid_to_string(other), do: to_string(other)

  defp message_id_string(value) do
    case MessageId.to_string(value) do
      {:ok, string} -> string
      :error -> nil
    end
  end

  defp resolve_history_bucket(params, user_id_bin, room_id) do
    cursor = normalize_cursor(Map.get(params, "before"))

    with {:ok, requested_bucket} <- parse_bucket(Map.get(params, "bucket")),
         {:ok, cursor_bucket} <- cursor_bucket(cursor),
         :ok <- buckets_match(requested_bucket, cursor_bucket) do
      {:ok, requested_bucket || cursor_bucket || HistoryBucket.latest(user_id_bin, room_id)}
    end
  end

  defp normalize_cursor(nil), do: nil
  defp normalize_cursor(value) when is_binary(value), do: String.trim(value)
  defp normalize_cursor(_value), do: :invalid

  defp parse_bucket(nil), do: {:ok, nil}

  defp parse_bucket(value) when is_integer(value) do
    if valid_bucket?(value), do: {:ok, value}, else: :error
  end

  defp parse_bucket(value) when is_binary(value) do
    case Integer.parse(String.trim(value)) do
      {bucket, ""} -> parse_bucket(bucket)
      _ -> :error
    end
  end

  defp parse_bucket(_value), do: :error

  defp cursor_bucket(nil), do: {:ok, nil}
  defp cursor_bucket(:invalid), do: :error
  defp cursor_bucket(""), do: :error
  defp cursor_bucket(cursor), do: MessageId.bucket(cursor)

  defp buckets_match(nil, _cursor_bucket), do: :ok
  defp buckets_match(_requested_bucket, nil), do: :ok
  defp buckets_match(bucket, bucket), do: :ok
  defp buckets_match(_requested_bucket, _cursor_bucket), do: :error

  defp valid_bucket?(bucket) when bucket >= 197_001 and bucket <= 999_912 do
    rem(bucket, 100) in 1..12
  end

  defp valid_bucket?(_bucket), do: false

  defp storage_unavailable(conn) do
    conn
    |> put_status(:service_unavailable)
    |> json(%{error: "chat storage unavailable"})
  end

  defp to_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {v, _} -> v
      _ -> default
    end
  end

  defp to_int(value, _default) when is_integer(value), do: value
  defp to_int(_, default), do: default
end
