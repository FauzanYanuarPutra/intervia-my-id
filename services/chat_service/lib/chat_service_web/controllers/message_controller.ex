defmodule ChatServiceWeb.MessageController do
  use ChatServiceWeb, :controller

  alias ChatService.{AidaBot, Repo}
  alias ChatService.DmRoom
  alias ChatService.Security

  def index(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    user_id_bin = conn.assigns.current_user_id_bin

    if not room_member?(room_id, user_id_bin) do
      conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
    else
      limit =
        params
        |> Map.get("limit", "50")
        |> to_int(50)
        |> min(100)
        |> max(1)

      bucket =
        case Map.get(params, "bucket") do
          nil -> Repo.get_bucket(DateTime.utc_now())
          v when is_binary(v) -> String.to_integer(v)
          v when is_integer(v) -> v
          _ -> Repo.get_bucket(DateTime.utc_now())
        end

      query =
        if Map.has_key?(params, "before") do
          "SELECT * FROM messages WHERE room_id = ? AND bucket = ? AND message_id < ? ORDER BY message_id DESC LIMIT ?"
        else
          "SELECT * FROM messages WHERE room_id = ? AND bucket = ? ORDER BY message_id DESC LIMIT ?"
        end

      args =
        if Map.has_key?(params, "before") do
          before_id = Map.get(params, "before", "") |> to_string() |> String.trim()

          case Ecto.UUID.dump(before_id) do
            {:ok, _} ->
              [{"text", room_id}, {"int", bucket}, {"uuid", before_id}, {"int", limit}]

            :error ->
              :invalid_before
          end
        else
          [{"text", room_id}, {"int", bucket}, {"int", limit}]
        end

      case args do
        :invalid_before ->
          conn |> put_status(:bad_request) |> json(%{error: "invalid before cursor"})

        _ ->
          case Repo.execute(query, args) do
            {:ok, rows} ->
              data =
                Enum.map(rows, fn row ->
                  %{
                    message_id: row["message_id"],
                    sender_id: uuid_to_string(row["sender_id"]),
                    content: row["content"],
                    message_type: row["message_type"] || "text",
                    attachments: row["attachments"] || [],
                    is_edited: row["is_edited"] || false,
                    is_deleted: row["is_deleted"] || false,
                    sent_at: row["sent_at"]
                  }
                end)

              room_name = resolve_room_name(room_id, user_id_bin)
              json(conn, %{data: data, room_name: room_name})

            _ ->
              conn |> put_status(:internal_server_error) |> json(%{error: "db error"})
          end
      end
    end
  end

  def create(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    user_id_bin = conn.assigns.current_user_id_bin
    raw_content = params["content"] || conn.body_params["content"] || ""

    # Media support: optional type + attachments
    raw_type = params["type"] || conn.body_params["type"] || "text"
    message_type = normalize_message_type(raw_type)
    attachments = normalize_attachments(params["attachments"] || conn.body_params["attachments"])

    # Security & Performance: sanitize text content and enforce limits
    content = raw_content |> HtmlSanitizeEx.strip_tags() |> String.trim()
    has_media = attachments != []
    scan_result = if content == "", do: %{action: :allow}, else: Security.scan_content(content)

    cond do
      content == "" and not has_media ->
        conn |> put_status(:bad_request) |> json(%{error: "content or attachment is required"})

      byte_size(content) > 5000 ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "message too long (max 5000 characters)"})

      has_media and length(attachments) > 10 ->
        conn |> put_status(:bad_request) |> json(%{error: "too many attachments"})

      scan_result.action == :block ->
        conn |> put_status(:bad_request) |> json(%{error: "message blocked"})

      true ->
        if not room_member?(room_id, user_id_bin) do
          conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
        else
          sent_at = DateTime.utc_now()
          bucket_int = Repo.get_bucket(sent_at)

          query = """
          INSERT INTO messages (room_id, bucket, message_id, sender_id, content, message_type, attachments, sent_at)
          VALUES (?, ?, now(), ?, ?, ?, ?, ?)
          """

          case Repo.execute(query, [
                 {"text", room_id},
                 {"int", bucket_int},
                 {"uuid", user_id_bin},
                 {"text", content},
                 {"text", message_type},
                 {"list<text>", attachments},
                 {"timestamp", sent_at}
               ]) do
            {:ok, _} ->
              payload = %{
                room_id: room_id,
                sender_id_bin: user_id_bin,
                body:
                  if(content == "",
                    do: media_fallback_text(message_type, attachments),
                    else: content
                  ),
                sent_at: sent_at
              }

              update_inbox_and_unread(payload)

              # Realtime: broadcast to all subscribers of this room (Endpoint.broadcast is the correct API)
              topic = "room:" <> room_id
              sender_id_str = conn.assigns[:current_user_id] || Ecto.UUID.cast!(user_id_bin)

              socket_payload = %{
                message_id: Ecto.UUID.generate(),
                sender_id: sender_id_str,
                body: content,
                content: content,
                message_type: message_type,
                attachments: attachments,
                sent_at: DateTime.to_iso8601(sent_at)
              }

              ChatServiceWeb.Endpoint.broadcast!(topic, "new_message", socket_payload)
              broadcast_inbox_updated(room_id)

              maybe_reply_as_aida(%{
                room_id: room_id,
                sender_id: sender_id_str,
                content: content,
                message_type: message_type,
                attachments: attachments
              })

              json(conn |> put_status(201), %{
                data: %{
                  room_id: room_id,
                  sender_id: conn.assigns[:current_user_id],
                  content: content,
                  message_type: message_type,
                  attachments: attachments,
                  sent_at: DateTime.to_iso8601(sent_at)
                }
              })

            _ ->
              conn |> put_status(:internal_server_error) |> json(%{error: "db error"})
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
      Repo.execute("DELETE FROM unread_counters WHERE user_id = ? AND room_id = ?", [
        {"uuid", user_id_bin},
        {"text", room_id}
      ])

      json(conn, %{status: "ok"})
    end
  end

  defp update_inbox_and_unread(m) do
    members = fetch_room_members(m.room_id)
    {room_type, room_name, room_avatar} = fetch_room_meta(m.room_id)

    Enum.each(members, fn member_id_bin ->
      is_sender = member_id_bin == m.sender_id_bin

      Repo.execute(
        """
        INSERT INTO user_rooms (user_id, last_message_at, room_id, room_type, room_name, room_avatar, last_message, last_sender, unread_count, is_pinned)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
          {"uuid", member_id_bin},
          {"timestamp", m.sent_at},
          {"text", m.room_id},
          {"text", room_type},
          {"text", room_name},
          {"text", room_avatar},
          {"text", m.body},
          {"uuid", m.sender_id_bin},
          {"int", if(is_sender, do: 0, else: 1)},
          {"boolean", false}
        ]
      )

      if not is_sender do
        Repo.execute(
          "UPDATE unread_counters SET unread = unread + 1 WHERE user_id = ? AND room_id = ?",
          [{"uuid", member_id_bin}, {"text", m.room_id}]
        )
      end
    end)
  end

  defp fetch_room_members(room_id) do
    case Repo.execute("SELECT user_id FROM room_members WHERE room_id = ?", [{"text", room_id}]) do
      {:ok, rows} -> Enum.map(rows, & &1["user_id"])
      _ -> []
    end
  end

  defp fetch_room_meta(room_id) do
    case Repo.execute(
           "SELECT room_type, room_name, room_avatar FROM rooms WHERE room_id = ? LIMIT 1",
           [{"text", room_id}]
         ) do
      {:ok, [row | _]} ->
        {
          row["room_type"] || "dm",
          row["room_name"] || room_id,
          row["room_avatar"] || ""
        }

      _ ->
        {"dm", room_id, ""}
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
      {:ok, rows} -> rows != []
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
        case Repo.execute("SELECT display_name, username FROM core.users WHERE user_id = ? LIMIT 1", [
               {"uuid", peer_id_bin}
             ]) do
          {:ok, [row | _]} -> row["display_name"] || row["username"]
          _ -> nil
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

  defp normalize_attachments(nil), do: []

  defp normalize_attachments(list) when is_list(list) do
    list
    |> Enum.filter(&is_binary/1)
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.take(10)
  end

  defp normalize_attachments(one) when is_binary(one), do: normalize_attachments([one])
  defp normalize_attachments(_), do: []

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
          message_type: incoming.message_type,
          attachments: incoming.attachments || []
        )

      if String.trim(reply_text) != "" do
        with {:ok, bot_id_bin} <- Ecto.UUID.dump(AidaBot.bot_id()) do
          sent_at = DateTime.utc_now()
          bucket_int = Repo.get_bucket(sent_at)
          topic = "room:" <> room_id

          ensure_bot_projection(bot_id_bin, sent_at)

          Repo.execute(
            """
            INSERT INTO messages (room_id, bucket, message_id, sender_id, content, message_type, attachments, sent_at)
            VALUES (?, ?, now(), ?, ?, ?, ?, ?)
            """,
            [
              {"text", room_id},
              {"int", bucket_int},
              {"uuid", bot_id_bin},
              {"text", reply_text},
              {"text", "text"},
              {"list<text>", []},
              {"timestamp", sent_at}
            ]
          )

          update_inbox_and_unread(%{
            room_id: room_id,
            sender_id_bin: bot_id_bin,
            body: reply_text,
            sent_at: sent_at
          })

          ChatServiceWeb.Endpoint.broadcast!(topic, "new_message", %{
            message_id: Ecto.UUID.generate(),
            sender_id: AidaBot.bot_id(),
            body: reply_text,
            content: reply_text,
            message_type: "text",
            attachments: [],
            sent_at: DateTime.to_iso8601(sent_at)
          })

          broadcast_inbox_updated(room_id)
        end
      end
    end

    :ok
  end

  defp maybe_reply_as_aida(_), do: :ok

  defp ensure_bot_projection(bot_id_bin, now) do
    Repo.execute(
      """
      INSERT INTO core.users (user_id, display_name, avatar_url, last_active, updated_at)
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

  defp to_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {v, _} -> v
      _ -> default
    end
  end

  defp to_int(value, _default) when is_integer(value), do: value
  defp to_int(_, default), do: default
end
