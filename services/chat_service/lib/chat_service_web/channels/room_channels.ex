# lib/chat_service_web/channels/room_channel.ex
defmodule ChatServiceWeb.RoomChannel do
  use ChatServiceWeb, :channel

  alias ChatService.{AidaBot, IdentityClient, Repo, Security}
  alias ChatServiceWeb.Presence
  require Logger

  @history_limit 50
  @rate_max_msg 8

  # --- JOIN ROOM ---
  @impl true
  def join("room:" <> room_id_raw, params, socket) do
    room_id = URI.decode(room_id_raw)

    if can_join_room?(socket, room_id) do
      last_seen = Map.get(params, "last_seen_id")
      Logger.info("[Channel] User #{socket.assigns.user_id} joined #{room_id}")

      # Kirim sinyal ke diri sendiri untuk proses background
      send(self(), {:after_join, room_id, last_seen})

      {:ok, assign(socket, :room_id, room_id)}
    else
      Logger.warning("[Channel] Unauthorized join: #{socket.assigns.user_id}")
      {:error, %{reason: "unauthorized"}}
    end
  end

  # --- AFTER JOIN ---
  @impl true
  def handle_info({:after_join, room_id, last_seen_id}, socket) do
    # 1. Track Presence
    track_presence(socket)

    # 2. Push state awal (agar frontend berhenti "Checking presence")
    push(socket, "presence_state", Presence.list(socket))

    # 3. Fetch History secara Async
    Task.start(fn ->
      history = fetch_history(room_id, last_seen_id)
      push(socket, "history", %{messages: history})
    end)

    {:noreply, socket}
  end

  # --- MESSAGE HANDLER ---
  @impl true
  def handle_in("send_message", payload, socket) when is_map(payload) do
    {body, ref, message_type, attachments} = extract_message_payload(payload)
    process_send_message(body, ref, message_type, attachments, socket)
  end

  # Backward-compatible alias used by older WWW clients.
  @impl true
  def handle_in("relay_message", payload, socket) when is_map(payload) do
    {body, ref, message_type, attachments} = extract_message_payload(payload)
    process_send_message(body, ref, message_type, attachments, socket)
  end

  @impl true
  def handle_in("read", _payload, socket) do
    # Mark unread counter as cleared for current user in this room.
    Repo.execute("DELETE FROM unread_counters WHERE user_id = ? AND room_id = ?", [
      {"uuid", socket.assigns.user_id_bin},
      {"text", socket.assigns.room_id}
    ])

    broadcast_from!(socket, "read", %{
      user_id: socket.assigns.user_id,
      room_id: socket.assigns.room_id
    })

    {:reply, {:ok, %{status: "ok"}}, socket}
  end

  # --- TYPING ---
  @impl true
  def handle_in("typing", %{"is_typing" => status}, socket) do
    broadcast_from!(socket, "typing", %{
      user_id: socket.assigns.user_id,
      username: socket.assigns.username,
      is_typing: status
    })

    {:noreply, socket}
  end

  # --- CALL SIGNALING ---
  @impl true
  def handle_in("call_start", payload, socket) do
    with :ok <- check_permission(socket, "call:start") do
      call_id =
        case Map.get(payload, "call_id") do
          v when is_binary(v) and v != "" -> v
          _ -> Ecto.UUID.generate()
        end

      call_type = normalize_call_type(Map.get(payload, "call_type"))
      profile = current_user_profile(socket)

      broadcast_from!(socket, "call_incoming", %{
        call_id: call_id,
        caller_id: socket.assigns.user_id,
        caller_username: profile.username,
        caller_avatar: profile.avatar,
        caller_avatar_style: profile.avatar_style,
        call_type: call_type
      })

      broadcast_call_event(socket, "incoming_call", %{
        call_id: call_id,
        room_id: socket.assigns.room_id,
        caller_id: socket.assigns.user_id,
        caller_username: profile.username,
        caller_avatar: profile.avatar,
        caller_avatar_style: profile.avatar_style,
        call_type: call_type
      })

      {:reply, {:ok, %{call_id: call_id, call_type: call_type}}, socket}
    else
      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  @impl true
  def handle_in("call_accept", %{"call_id" => call_id}, socket) do
    broadcast_from!(socket, "call_accepted", %{
      call_id: call_id,
      user_id: socket.assigns.user_id
    })

    broadcast_call_event(socket, "call_accepted", %{
      call_id: call_id,
      room_id: socket.assigns.room_id,
      user_id: socket.assigns.user_id
    })

    {:reply, {:ok, %{call_id: call_id}}, socket}
  end

  @impl true
  def handle_in("call_reject", %{"call_id" => call_id}, socket) do
    broadcast_from!(socket, "call_rejected", %{
      call_id: call_id,
      user_id: socket.assigns.user_id
    })

    broadcast_call_event(socket, "call_rejected", %{
      call_id: call_id,
      room_id: socket.assigns.room_id,
      user_id: socket.assigns.user_id
    })

    {:reply, {:ok, %{call_id: call_id}}, socket}
  end

  @impl true
  def handle_in("call_end", %{"call_id" => call_id}, socket) do
    broadcast_from!(socket, "call_ended", %{
      call_id: call_id,
      user_id: socket.assigns.user_id
    })

    broadcast_call_event(socket, "call_ended", %{
      call_id: call_id,
      room_id: socket.assigns.room_id,
      user_id: socket.assigns.user_id
    })

    {:reply, {:ok, %{call_id: call_id}}, socket}
  end

  @impl true
  def handle_in("call_offer", %{"call_id" => call_id, "offer" => offer}, socket) do
    broadcast_from!(socket, "call_offer_received", %{
      call_id: call_id,
      offer: offer,
      from_user_id: socket.assigns.user_id
    })

    {:reply, {:ok, %{call_id: call_id}}, socket}
  end

  @impl true
  def handle_in("call_answer", %{"call_id" => call_id, "answer" => answer}, socket) do
    broadcast_from!(socket, "call_answer_received", %{
      call_id: call_id,
      answer: answer,
      from_user_id: socket.assigns.user_id
    })

    {:reply, {:ok, %{call_id: call_id}}, socket}
  end

  @impl true
  def handle_in("call_ice_candidate", %{"call_id" => call_id, "candidate" => candidate}, socket) do
    broadcast_from!(socket, "call_ice_candidate_received", %{
      call_id: call_id,
      candidate: candidate,
      from_user_id: socket.assigns.user_id
    })

    {:reply, {:ok, %{call_id: call_id}}, socket}
  end

  defp process_send_message(body, ref, message_type, attachments, socket) do
    with :ok <- rate_limit(socket),
         :ok <- check_permission(socket, "chat:send"),
         {:ok, clean_body} <- sanitize(body, attachments),
         {:ok, scan_result} <- scan_content(clean_body) do
      profile = current_user_profile(socket)
      message_id = Ecto.UUID.generate()
      sent_at = DateTime.utc_now()
      normalized_type = normalize_message_type(message_type)
      normalized_attachments = normalize_attachments(attachments)

      display_body =
        if clean_body == "" do
          case normalized_type do
            "image" -> "Image"
            "video" -> "Video"
            "audio" -> "Audio"
            "file" -> "File"
            "sticker" -> "Sticker"
            "offer" -> "Offer"
            "transaction" -> "Transaction update"
            "application" -> "Application"
            "listing" -> "Listing shared"
            "order" -> "Order update"
            "milestone" -> "Milestone update"
            "ride_update" -> "Ride update"
            "delivery_update" -> "Delivery update"
            "job_update" -> "Job update"
            _ -> "Attachment"
          end
        else
          clean_body
        end

      payload = %{
        message_id: message_id,
        client_ref: ref,
        room_id: socket.assigns.room_id,
        sender_id: socket.assigns.user_id,
        sender_username: profile.username,
        sender_avatar: profile.avatar,
        sender_avatar_style: profile.avatar_style,
        body: display_body,
        content: display_body,
        message_type: normalized_type,
        attachments: normalized_attachments,
        sent_at: sent_at,
        is_scam: scan_result == :warn
      }

      broadcast!(socket, "new_message", payload)

      # Persist ke Scylla secara Async
      Task.Supervisor.start_child(ChatService.TaskSupervisor, fn ->
        persist_message(payload, socket.assigns.user_id_bin)
        update_last_active_projection(socket.assigns.user_id_bin, sent_at)
        update_inbox_and_unread(payload, socket.assigns.user_id_bin)
        broadcast_inbox_updated(payload.room_id)
        maybe_reply_as_aida(payload)
      end)

      {:reply, {:ok, payload}, socket}
    else
      {:error, reason} ->
        {:reply, {:error, %{reason: inspect(reason)}}, socket}
    end
  end

  # --- HELPERS ---
  defp can_join_room?(socket, room_id) do
    user_id_bin = socket.assigns[:user_id_bin]
    current_room_id = socket.assigns[:room_id] || room_id

    if is_nil(user_id_bin) or is_nil(current_room_id) do
      false
    else
      case Repo.execute(
             "SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
             [{"text", current_room_id}, {"uuid", user_id_bin}]
           ) do
        {:ok, rows} -> rows != []
        _ -> false
      end
    end
  end

  # Samakan juga untuk izin kirim pesan
  defp check_permission(socket, _permission) do
    if can_join_room?(socket, socket.assigns[:room_id]), do: :ok, else: {:error, :forbidden}
  end

  # defp can_join_room?(socket, _room_id) do
  #   perms = socket.assigns.permissions || []
  #   role = socket.assigns.role
  #   # Logic: Izinkan jika admin OR punya permission OR list permission kosong (default)
  #   role == "admin" or "chat:join" in perms or perms == []
  # end

  # defp check_permission(socket, perm) do
  #   perms = socket.assigns.permissions || []
  #   if socket.assigns.role == "admin" or perm in perms or perms == [] do
  #     :ok
  #   else
  #     {:error, :forbidden}
  #   end
  # end

  defp sanitize(body, attachments) do
    clean = body |> HtmlSanitizeEx.strip_tags() |> String.trim()
    has_media = is_list(attachments) and attachments != []
    if clean == "" and not has_media, do: {:error, "empty"}, else: {:ok, clean}
  end

  defp scan_content(body) do
    # Pastikan modul ChatService.Security sudah ada
    if body == "" do
      {:ok, :ok}
    else
      case Security.scan_content(body) do
        %{action: :block} -> {:error, "blocked"}
        %{action: :warn} -> {:ok, :warn}
        _ -> {:ok, :ok}
      end
    end
  end

  defp track_presence(socket) do
    profile = current_user_profile(socket)

    Presence.track(socket, socket.assigns.user_id, %{
      username: profile.username,
      avatar: profile.avatar,
      avatar_style: profile.avatar_style,
      online_at: System.system_time(:second)
    })
  end

  defp rate_limit(socket) do
    key = {:rate, socket.assigns.user_id}
    # Update counter di ETS yang dibuat di application.ex
    case :ets.update_counter(:rate_limiter, key, {2, 1}, {key, 0, 0}) do
      count when count <= @rate_max_msg -> :ok
      _ -> {:error, :rate_limited}
    end
  end

  # --- SCYLLA DATA LAYER ---
  defp fetch_history(room_id, last_id) do
    bucket = Repo.get_bucket(DateTime.utc_now())

    query =
      "SELECT * FROM messages WHERE room_id = ? AND bucket = ? ORDER BY message_id DESC LIMIT ?"

    case Repo.execute(query, [{"text", room_id}, {"int", bucket}, {"int", @history_limit}]) do
      {:ok, rows} -> Enum.map(rows, &format_message/1)
      _ -> []
    end
  end

  defp format_message(row) do
    %{
      message_id: Ecto.UUID.cast!(row["message_id"]),
      sender_id: Ecto.UUID.cast!(row["sender_id"]),
      body: row["content"],
      content: row["content"],
      message_type: row["message_type"] || "text",
      attachments: row["attachments"] || [],
      sent_at: row["sent_at"]
    }
  end

  defp persist_message(m, _sender_bin) do
    # 1. Pastikan bucket adalah Integer (YYYYMM)
    bucket = String.to_integer(Calendar.strftime(m.sent_at, "%Y%m"))

    # 2. Dump UUID sender dengan benar
    {:ok, sender_uuid_bin} = Ecto.UUID.dump(m.sender_id)

    # 3. Gunakan 'now()' milik Scylla untuk message_id agar pasti valid timeuuid
    query = """
      INSERT INTO messages (room_id, bucket, message_id, sender_id, content, message_type, attachments, is_edited, is_deleted, sent_at)
      VALUES (?, ?, now(), ?, ?, ?, ?, ?, ?, ?)
    """

    case Repo.execute(query, [
           {"text", m.room_id},
           {"int", bucket},
           {"uuid", sender_uuid_bin},
           {"text", m.body},
           {"text", m.message_type || "text"},
           {"list<text>", m.attachments || []},
           {"boolean", false},
           {"boolean", false},
           {"timestamp", m.sent_at}
         ]) do
      {:ok, _} -> Logger.info("[Scylla] Message persisted successfully")
      {:error, reason} -> Logger.error("[Scylla] Failed to persist message: #{inspect(reason)}")
    end
  end

  defp update_last_active_projection(bin_id, ts) do
    Repo.execute("UPDATE core.users SET last_active = ? WHERE user_id = ?", [
      {"timestamp", ts},
      {"uuid", bin_id}
    ])
  end

  defp extract_message_payload(payload) do
    body = Map.get(payload, "body") || Map.get(payload, "content") || ""

    ref =
      Map.get(payload, "client_ref") ||
        Map.get(payload, "message_id") ||
        Ecto.UUID.generate()

    message_type = Map.get(payload, "message_type") || Map.get(payload, "type") || "text"
    attachments = Map.get(payload, "attachments") || []

    {body, ref, message_type, attachments}
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

  defp update_inbox_and_unread(m, sender_id_bin) do
    members = fetch_room_members(m.room_id)
    {room_type, room_name, room_avatar} = fetch_room_meta(m.room_id)

    Enum.each(members, fn member_id_bin ->
      is_sender = member_id_bin == sender_id_bin

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
          {"uuid", sender_id_bin},
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

  defp broadcast_call_event(socket, event, payload) do
    socket.assigns.room_id
    |> fetch_room_members()
    |> Enum.reject(&(&1 == socket.assigns.user_id_bin))
    |> Enum.each(fn member_id_bin ->
      topic = "user:" <> Ecto.UUID.cast!(member_id_bin)

      Phoenix.PubSub.broadcast(
        ChatService.PubSub,
        topic,
        %Phoenix.Socket.Broadcast{
          topic: topic,
          event: event,
          payload: payload
        }
      )
    end)
  end

  defp to_binary_uuid(nil), do: nil

  defp to_binary_uuid(str),
    do:
      case(Ecto.UUID.dump(str),
        do: (
          {:ok, b} -> b
          _ -> nil
        )
      )

  defp normalize_call_type(v) when is_binary(v) do
    t = String.downcase(String.trim(v))
    if t in ["video", "voice"], do: t, else: "voice"
  end

  defp normalize_call_type(_), do: "voice"

  defp maybe_reply_as_aida(%{room_id: room_id, sender_id: sender_id} = incoming) do
    if AidaBot.should_reply?(room_id, sender_id) do
      reply_text =
        AidaBot.build_reply(incoming.content || incoming.body || "",
          room_id: room_id,
          message_type: incoming.message_type,
          attachments: incoming.attachments || []
        )

      if String.trim(reply_text) != "" do
        Process.sleep(350)

        with {:ok, bot_id_bin} <- Ecto.UUID.dump(AidaBot.bot_id()) do
          sent_at = DateTime.utc_now()

          payload = %{
            message_id: Ecto.UUID.generate(),
            room_id: room_id,
            sender_id: AidaBot.bot_id(),
            sender_username: AidaBot.bot_name(),
            sender_avatar: AidaBot.bot_avatar(),
            body: reply_text,
            content: reply_text,
            message_type: "text",
            attachments: [],
            sent_at: sent_at,
            is_scam: false
          }

          ensure_bot_projection(bot_id_bin, sent_at)
          ChatServiceWeb.Endpoint.broadcast!("room:" <> room_id, "new_message", payload)
          persist_message(payload, bot_id_bin)
          update_last_active_projection(bot_id_bin, sent_at)
          update_inbox_and_unread(payload, bot_id_bin)
          broadcast_inbox_updated(room_id)
        end
      end
    end

    :ok
  end

  defp maybe_reply_as_aida(_), do: :ok

  defp current_user_profile(socket) do
    user_id = socket.assigns.user_id
    fallback_username = socket.assigns.username
    fallback_avatar = socket.assigns.avatar
    fallback_style = socket.assigns[:avatar_style]

    case IdentityClient.fetch_public_profile(user_id) do
      {:ok, profile} ->
        %{
          username:
            IdentityClient.display_name(profile, fallback_username) ||
              fallback_username,
          avatar: IdentityClient.avatar_url(profile, fallback_avatar) || fallback_avatar,
          avatar_style: IdentityClient.avatar_style(profile, fallback_style)
        }

      _ ->
        %{
          username: fallback_username,
          avatar: fallback_avatar,
          avatar_style: fallback_style
        }
    end
  end

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
end
