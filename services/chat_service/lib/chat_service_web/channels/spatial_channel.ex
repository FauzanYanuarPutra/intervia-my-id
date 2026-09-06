# lib/chat_service_web/channels/spatial_channel.ex
defmodule ChatServiceWeb.SpatialChannel do
  use ChatServiceWeb, :channel

  alias ChatService.{Repo, PresenceCache, SpatialTracker}
  alias ChatServiceWeb.Presence
  require Logger

  # Radius untuk proximity chat (dalam unit grid, misalnya pixel atau tile)
  @proximity_radius 150.0
  @update_interval_ms 1000

  # Join spatial room (misalnya "spatial:world:1" atau "spatial:lobby")
  @impl true
  def join("spatial:" <> room_id, _params, socket) do
    Logger.info("[Spatial] User #{socket.assigns.user_id} joining spatial room: #{room_id}")

    user_id = socket.assigns.user_id

    # Set posisi awal (spawn point atau random)
    initial_x = 400.0
    initial_y = 300.0

    # Update tracker dengan posisi awal
    SpatialTracker.update_position(room_id, user_id, initial_x, initial_y, %{
      username: socket.assigns.username,
      avatar: socket.assigns.avatar
    })

    # Track presence dengan metadata posisi
    track_spatial_presence(socket, room_id, initial_x, initial_y)

    # Kirim daftar user yang sudah ada di room
    send(self(), {:after_join, room_id})

    {:ok, assign(socket, :spatial_room_id, room_id)}
  end

  @impl true
  def handle_info({:after_join, room_id}, socket) do
    # Push initial presence state
    presence_list = Presence.list(socket)
    push(socket, "presence_state", presence_list)

    # Juga kirim semua user dari tracker
    all_users =
      SpatialTracker.get_all_users_in_room(room_id)
      |> Enum.map(fn {uid, pos} ->
        %{
          user_id: uid,
          username: pos.metadata[:username] || uid,
          avatar: pos.metadata[:avatar],
          x: pos.x,
          y: pos.y
        }
      end)

    push(socket, "users_list", %{users: all_users})

    {:noreply, socket}
  end

  # Update posisi user (dipanggil dari frontend saat user bergerak)
  @impl true
  def handle_in("update_position", %{"x" => x, "y" => y} = _params, socket) do
    room_id = socket.assigns.spatial_room_id
    user_id = socket.assigns.user_id

    # Validasi posisi (misalnya dalam bounds map: 0-800 untuk x, 0-600 untuk y)
    x_float = parse_float(x, 0.0) |> clamp(0.0, 800.0)
    y_float = parse_float(y, 0.0) |> clamp(0.0, 600.0)

    # Update tracker
    SpatialTracker.update_position(room_id, user_id, x_float, y_float, %{
      username: socket.assigns.username,
      avatar: socket.assigns.avatar
    })

    # Update presence dengan posisi baru
    track_spatial_presence(socket, room_id, x_float, y_float)

    # Hitung siapa yang dalam proximity dan broadcast update
    broadcast_position_update(socket, room_id, user_id, x_float, y_float)

    {:reply, {:ok, %{x: x_float, y: y_float}}, socket}
  end

  # Proximity chat: kirim pesan ke user dalam radius
  @impl true
  def handle_in("proximity_message", %{"body" => body, "x" => x, "y" => y} = _params, socket) do
    room_id = socket.assigns.spatial_room_id
    user_id = socket.assigns.user_id
    x_float = parse_float(x, 0.0)
    y_float = parse_float(y, 0.0)

    # Dapatkan semua user dalam proximity dari tracker
    nearby_users = SpatialTracker.get_nearby_users(room_id, x_float, y_float, @proximity_radius)

    # Broadcast ke user dalam range
    payload = %{
      message_id: Ecto.UUID.generate(),
      sender_id: user_id,
      sender_username: socket.assigns.username,
      sender_avatar: socket.assigns.avatar,
      body: body,
      x: x_float,
      y: y_float,
      sent_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    # Broadcast ke semua user di room, tapi dengan metadata bahwa ini proximity message
    # Client akan filter sendiri berdasarkan jarak
    broadcast_from!(
      socket,
      "proximity_message",
      Map.put(payload, :sender_position, %{x: x_float, y: y_float})
    )

    {:reply, {:ok, %{sent_to: length(nearby_users)}}, socket}
  end

  # Request daftar user dalam proximity
  @impl true
  def handle_in("get_nearby_users", %{"x" => x, "y" => y} = _params, socket) do
    room_id = socket.assigns.spatial_room_id
    x_float = parse_float(x, 0.0)
    y_float = parse_float(y, 0.0)

    # Dapatkan user dalam proximity dari tracker
    nearby = SpatialTracker.get_nearby_users(room_id, x_float, y_float, @proximity_radius)

    push(socket, "nearby_users", %{
      users:
        Enum.map(nearby, fn {uid, pos} ->
          %{
            user_id: uid,
            x: pos.x,
            y: pos.y,
            distance: pos.distance,
            username: pos.metadata[:username],
            avatar: pos.metadata[:avatar]
          }
        end)
    })

    {:noreply, socket}
  end

  # Helper: Track presence dengan posisi
  defp track_spatial_presence(socket, room_id, x, y) do
    Presence.track(socket, socket.assigns.user_id, %{
      x: x,
      y: y,
      username: socket.assigns.username,
      avatar: socket.assigns.avatar,
      online_at: DateTime.utc_now() |> DateTime.to_iso8601()
    })
  end

  # Helper: Broadcast posisi update ke semua user di room
  defp broadcast_position_update(socket, room_id, user_id, x, y) do
    payload = %{
      user_id: user_id,
      username: socket.assigns.username,
      avatar: socket.assigns.avatar,
      x: x,
      y: y,
      updated_at: DateTime.utc_now() |> DateTime.to_iso8601()
    }

    broadcast_from!(socket, "position_update", payload)
  end

  # Helper: Clamp nilai antara min dan max
  defp clamp(value, min, max) when value < min, do: min
  defp clamp(value, min, max) when value > max, do: max
  defp clamp(value, _, _), do: value

  # Helper: Parse float dengan fallback
  defp parse_float(value, default) when is_float(value), do: value
  defp parse_float(value, default) when is_integer(value), do: value * 1.0

  defp parse_float(value, default) when is_binary(value) do
    case Float.parse(value) do
      {float_val, _} -> float_val
      :error -> default
    end
  end

  defp parse_float(_, default), do: default

  # Handle disconnect: remove user dari tracker
  @impl true
  def terminate(_reason, socket) do
    room_id = socket.assigns[:spatial_room_id]
    user_id = socket.assigns[:user_id]

    if room_id && user_id do
      SpatialTracker.remove_user(room_id, user_id)
      Logger.info("[Spatial] User #{user_id} left spatial room: #{room_id}")
    end

    :ok
  end
end
