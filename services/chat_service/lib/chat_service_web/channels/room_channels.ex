# lib/chat_service_web/channels/room_channel.ex
defmodule ChatServiceWeb.RoomChannel do
  use ChatServiceWeb, :channel

  alias ChatService.{
    AidaBot,
    AttachmentPolicy,
    CallSignaling,
    IdentityClient,
    MessagePersistence,
    RateLimiter,
    Repo,
    Security,
    TrustSafety,
    UnreadState
  }

  alias ChatServiceWeb.Presence
  require Logger

  @rate_max_msg 8
  @rate_window_ms 10_000
  @call_start_limit 3
  @call_control_limit 30
  @call_sdp_limit 12
  @call_ice_limit 180
  @call_rate_window_ms 60_000
  @max_sdp_bytes 64 * 1_024
  @max_ice_bytes 8 * 1_024

  # --- JOIN ROOM ---
  @impl true
  def join("room:" <> room_id_raw, _params, socket) do
    room_id = URI.decode(room_id_raw)

    if can_join_room?(socket, room_id) do
      Logger.info("[Channel] User #{socket.assigns.user_id} joined #{room_id}")

      # Kirim sinyal ke diri sendiri untuk proses background
      send(self(), :after_join)

      {:ok, assign(socket, :room_id, room_id)}
    else
      Logger.warning("[Channel] Unauthorized join: #{socket.assigns.user_id}")
      {:error, %{reason: "unauthorized"}}
    end
  end

  # --- AFTER JOIN ---
  @impl true
  def handle_info(:after_join, socket) do
    # 1. Track Presence
    track_presence(socket)

    # 2. Push state awal (agar frontend berhenti "Checking presence")
    push(socket, "presence_state", Presence.list(socket))

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
    case UnreadState.clear(socket.assigns.user_id_bin, socket.assigns.room_id) do
      :ok ->
        broadcast_from!(socket, "read", %{
          user_id: socket.assigns.user_id,
          room_id: socket.assigns.room_id
        })

        {:reply, {:ok, %{status: "ok"}}, socket}

      {:error, reason} ->
        Logger.error("[Scylla] Read receipt update failed: #{inspect(reason)}")
        {:reply, {:error, %{reason: "message_storage_unavailable"}}, socket}
    end
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
  def handle_in("call_start", payload, socket) when is_map(payload) do
    with :ok <- authorize_call_event(socket, :start),
         :ok <- ensure_direct_call_room(socket),
         :ok <-
           TrustSafety.ensure_room_send_allowed(
             socket.assigns.room_id,
             socket.assigns.user_id_bin
           ),
         {:ok, call_id} <- CallSignaling.start_call_id(Map.get(payload, "call_id")) do
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
        call_error(socket, reason)
    end
  end

  @impl true
  def handle_in("call_accept", payload, socket) when is_map(payload) do
    with :ok <- authorize_call_event(socket, :control),
         {:ok, call_id} <- CallSignaling.call_id(Map.get(payload, "call_id")) do
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
    else
      {:error, reason} -> call_error(socket, reason)
    end
  end

  @impl true
  def handle_in("call_reject", payload, socket) when is_map(payload) do
    with :ok <- authorize_call_event(socket, :control),
         {:ok, call_id} <- CallSignaling.call_id(Map.get(payload, "call_id")) do
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
    else
      {:error, reason} -> call_error(socket, reason)
    end
  end

  @impl true
  def handle_in("call_end", payload, socket) when is_map(payload) do
    with :ok <- authorize_call_event(socket, :control),
         {:ok, call_id} <- CallSignaling.call_id(Map.get(payload, "call_id")) do
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
    else
      {:error, reason} -> call_error(socket, reason)
    end
  end

  @impl true
  def handle_in("call_offer", payload, socket) when is_map(payload) do
    with :ok <- authorize_call_event(socket, :sdp),
         {:ok, call_id} <- CallSignaling.call_id(Map.get(payload, "call_id")),
         {:ok, offer} <- CallSignaling.json_object(Map.get(payload, "offer"), @max_sdp_bytes) do
      broadcast_from!(socket, "call_offer_received", %{
        call_id: call_id,
        offer: offer,
        from_user_id: socket.assigns.user_id
      })

      {:reply, {:ok, %{call_id: call_id}}, socket}
    else
      {:error, reason} -> call_error(socket, reason)
    end
  end

  @impl true
  def handle_in("call_answer", payload, socket) when is_map(payload) do
    with :ok <- authorize_call_event(socket, :sdp),
         {:ok, call_id} <- CallSignaling.call_id(Map.get(payload, "call_id")),
         {:ok, answer} <-
           CallSignaling.json_object(Map.get(payload, "answer"), @max_sdp_bytes) do
      broadcast_from!(socket, "call_answer_received", %{
        call_id: call_id,
        answer: answer,
        from_user_id: socket.assigns.user_id
      })

      {:reply, {:ok, %{call_id: call_id}}, socket}
    else
      {:error, reason} -> call_error(socket, reason)
    end
  end

  @impl true
  def handle_in("call_ice_candidate", payload, socket) when is_map(payload) do
    with :ok <- authorize_call_event(socket, :ice),
         {:ok, call_id} <- CallSignaling.call_id(Map.get(payload, "call_id")),
         {:ok, candidate} <-
           CallSignaling.json_object(Map.get(payload, "candidate"), @max_ice_bytes) do
      broadcast_from!(socket, "call_ice_candidate_received", %{
        call_id: call_id,
        candidate: candidate,
        from_user_id: socket.assigns.user_id
      })

      {:reply, {:ok, %{call_id: call_id}}, socket}
    else
      {:error, reason} -> call_error(socket, reason)
    end
  end

  @impl true
  def handle_in(event, _payload, socket)
      when event in [
             "call_start",
             "call_accept",
             "call_reject",
             "call_end",
             "call_offer",
             "call_answer",
             "call_ice_candidate"
           ] do
    case check_permission(socket, "call:signal") do
      :ok -> call_error(socket, :invalid_call_payload)
      {:error, reason} -> call_error(socket, reason)
    end
  end

  defp authorize_call_event(socket, kind) do
    with :ok <- check_permission(socket, "call:signal"),
         :ok <- rate_limit_call(socket, kind) do
      :ok
    end
  end

  defp rate_limit_call(socket, kind) do
    limit =
      case kind do
        :start -> @call_start_limit
        :control -> @call_control_limit
        :sdp -> @call_sdp_limit
        :ice -> @call_ice_limit
      end

    RateLimiter.check(
      {:call, kind, socket.assigns.user_id, socket.assigns.room_id},
      limit,
      @call_rate_window_ms
    )
  end

  defp ensure_direct_call_room(socket) do
    case Repo.execute(
           "SELECT room_type FROM rooms WHERE room_id = ? LIMIT 1",
           [{"text", socket.assigns.room_id}]
         ) do
      {:ok, rows} ->
        case Enum.take(rows, 1) do
          [%{"room_type" => "dm"}] -> :ok
          [_room] -> {:error, :calls_direct_only}
          [] -> {:error, :room_unavailable}
        end

      {:error, _reason} ->
        {:error, :room_unavailable}
    end
  end

  defp call_error(socket, reason) do
    {:reply, {:error, %{reason: safe_call_error(reason)}}, socket}
  end

  defp safe_call_error(:forbidden), do: "unauthorized"
  defp safe_call_error(:rate_limited), do: "rate_limited"
  defp safe_call_error(:calls_direct_only), do: "calls_direct_only"
  defp safe_call_error(:room_unavailable), do: "room_unavailable"
  defp safe_call_error(:blocked), do: "contact_blocked"
  defp safe_call_error(:storage_unavailable), do: "room_unavailable"
  defp safe_call_error(:invalid_call_id), do: "invalid_call_id"
  defp safe_call_error(:invalid_signal), do: "invalid_signal"
  defp safe_call_error(:invalid_call_payload), do: "invalid_call_payload"
  defp safe_call_error(_reason), do: "invalid_call_request"

  defp process_send_message(body, ref, message_type, attachments, socket) do
    normalized_type = normalize_message_type(message_type)

    with {:ok, normalized_attachments} <-
           AttachmentPolicy.normalize(normalized_type, attachments),
         :ok <- check_permission(socket, "chat:send"),
         {:ok, clean_body} <- sanitize(body, normalized_attachments),
         {:ok, scan_result} <- scan_content(clean_body),
         :ok <- rate_limit(socket),
         :ok <-
           TrustSafety.ensure_room_send_allowed(
             socket.assigns.room_id,
             socket.assigns.user_id_bin
           ) do
      profile = current_user_profile(socket)

      persistence_attrs = %{
        room_id: socket.assigns.room_id,
        sender_id_bin: socket.assigns.user_id_bin,
        client_ref: ref,
        content: clean_body,
        message_type: normalized_type,
        attachments: normalized_attachments
      }

      case MessagePersistence.persist(persistence_attrs) do
        {:ok, status, message} ->
          display_body =
            if message.content == "" do
              media_fallback_text(message.message_type)
            else
              message.content
            end

          payload = %{
            message_id: message.message_id,
            client_ref: message.client_ref,
            room_id: message.room_id,
            sender_id: socket.assigns.user_id,
            sender_username: profile.username,
            sender_avatar: profile.avatar,
            sender_avatar_style: profile.avatar_style,
            body: display_body,
            content: message.content,
            message_type: message.message_type,
            attachments: message.attachments,
            sent_at: message.sent_at,
            is_scam: scan_result == :warn,
            deduplicated: status == :duplicate
          }

          if status == :inserted do
            broadcast!(socket, "new_message", payload)

            Task.Supervisor.start_child(ChatService.TaskSupervisor, fn ->
              update_last_active_projection(socket.assigns.user_id_bin, message.sent_at)

              case update_inbox_and_unread(payload, socket.assigns.user_id_bin) do
                :ok ->
                  broadcast_inbox_updated(payload.room_id)

                {:error, reason} ->
                  Logger.error("[Scylla] Inbox projection failed: #{inspect(reason)}")
              end

              maybe_reply_as_aida(payload)
            end)
          end

          {:reply, {:ok, payload}, socket}

        {:error, :invalid_client_ref} ->
          {:reply, {:error, %{reason: "invalid_client_ref"}}, socket}

        {:error, :invalid_attachments} ->
          {:reply, {:error, %{reason: "invalid_attachments"}}, socket}

        {:error, :client_ref_conflict} ->
          {:reply, {:error, %{reason: "client_ref_conflict"}}, socket}

        {:error, reason} ->
          Logger.error("[Scylla] Message rejected because persistence failed: #{inspect(reason)}")
          {:reply, {:error, %{reason: "message_storage_unavailable"}}, socket}
      end
    else
      {:error, reason} ->
        {:reply, {:error, %{reason: safe_send_error(reason)}}, socket}
    end
  end

  defp safe_send_error(:blocked), do: "contact_blocked"
  defp safe_send_error(:storage_unavailable), do: "message_storage_unavailable"
  defp safe_send_error(:forbidden), do: "unauthorized"
  defp safe_send_error(:rate_limited), do: "rate_limited"
  defp safe_send_error(:invalid_attachments), do: "invalid_attachments"
  defp safe_send_error("empty"), do: "empty_message"
  defp safe_send_error("blocked"), do: "message_blocked"
  defp safe_send_error(_reason), do: "message_rejected"

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
        {:ok, rows} -> Enum.any?(rows)
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
    RateLimiter.check(key, @rate_max_msg, @rate_window_ms)
  end

  defp update_last_active_projection(bin_id, ts) do
    Repo.execute("UPDATE users SET last_active = ? WHERE user_id = ?", [
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

  defp media_fallback_text("image"), do: "Image"
  defp media_fallback_text("video"), do: "Video"
  defp media_fallback_text("audio"), do: "Audio"
  defp media_fallback_text("file"), do: "File"
  defp media_fallback_text("sticker"), do: "Sticker"
  defp media_fallback_text("offer"), do: "Offer"
  defp media_fallback_text("transaction"), do: "Transaction update"
  defp media_fallback_text("application"), do: "Application"
  defp media_fallback_text("listing"), do: "Listing shared"
  defp media_fallback_text("order"), do: "Order update"
  defp media_fallback_text("milestone"), do: "Milestone update"
  defp media_fallback_text("ride_update"), do: "Ride update"
  defp media_fallback_text("delivery_update"), do: "Delivery update"
  defp media_fallback_text("job_update"), do: "Job update"
  defp media_fallback_text(_type), do: "Attachment"

  defp update_inbox_and_unread(m, sender_id_bin) do
    with {:ok, members} <- fetch_room_members_result(m.room_id),
         {:ok, {room_type, room_name, room_avatar}} <- fetch_room_meta_result(m.room_id) do
      Enum.reduce_while(members, :ok, fn member_id_bin, :ok ->
        case update_member_inbox(
               m,
               sender_id_bin,
               member_id_bin,
               room_type,
               room_name,
               room_avatar
             ) do
          :ok -> {:cont, :ok}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
    end
  end

  defp update_member_inbox(m, sender_id_bin, member_id_bin, room_type, room_name, room_avatar) do
    is_sender = member_id_bin == sender_id_bin
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
          {"uuid", sender_id_bin},
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
        do:
          (
            {:ok, b} -> b
            _ -> nil
          )
      )

  defp normalize_call_type(v) when is_binary(v) and byte_size(v) <= 16 do
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
          case MessagePersistence.persist(%{
                 room_id: room_id,
                 sender_id_bin: bot_id_bin,
                 client_ref: "aida:" <> Ecto.UUID.generate(),
                 content: reply_text,
                 message_type: "text",
                 attachments: []
               }) do
            {:ok, :inserted, message} ->
              payload = %{
                message_id: message.message_id,
                client_ref: message.client_ref,
                room_id: room_id,
                sender_id: AidaBot.bot_id(),
                sender_username: AidaBot.bot_name(),
                sender_avatar: AidaBot.bot_avatar(),
                body: message.content,
                content: message.content,
                message_type: message.message_type,
                attachments: message.attachments,
                sent_at: message.sent_at,
                is_scam: false
              }

              ensure_bot_projection(bot_id_bin, message.sent_at)
              ChatServiceWeb.Endpoint.broadcast!("room:" <> room_id, "new_message", payload)
              update_last_active_projection(bot_id_bin, message.sent_at)

              if update_inbox_and_unread(payload, bot_id_bin) == :ok do
                broadcast_inbox_updated(room_id)
              end

            {:ok, :duplicate, _message} ->
              :ok

            {:error, reason} ->
              Logger.error("[Scylla] Aida reply persistence failed: #{inspect(reason)}")
          end
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
end
