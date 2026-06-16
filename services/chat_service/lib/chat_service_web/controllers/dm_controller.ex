defmodule ChatServiceWeb.DmController do
  use ChatServiceWeb, :controller

  alias ChatService.Repo
  alias ChatService.DmRoom

  def create(conn, %{"peer_user_id" => peer_user_id}) when is_binary(peer_user_id) do
    user_id_bin = conn.assigns.current_user_id_bin

    with {:ok, peer_id_bin} <- Ecto.UUID.dump(peer_user_id),
         :ok <- DmRoom.validate_not_self(user_id_bin, peer_id_bin) do
      room_id = DmRoom.build_room_id(user_id_bin, peer_id_bin)
      now = DateTime.utc_now()

      ensure_room(room_id, user_id_bin, now)
      ensure_room_member(room_id, user_id_bin, "owner", now)
      ensure_room_member(room_id, peer_id_bin, "member", now)

      seed_user_room(room_id, user_id_bin, now)
      seed_user_room(room_id, peer_id_bin, now)

      json(conn, %{data: %{room_id: room_id}})
    else
      {:error, :self_chat} ->
        conn |> put_status(:bad_request) |> json(%{error: "cannot chat with yourself"})

      _ ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid peer_user_id"})
    end
  end

  def create(conn, _params) do
    conn |> put_status(:bad_request) |> json(%{error: "peer_user_id is required"})
  end

  defp ensure_room(room_id, created_by_bin, now) do
    Repo.execute(
      """
      INSERT INTO rooms (room_id, room_type, room_name, room_avatar, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      IF NOT EXISTS
      """,
      [
        {"text", room_id},
        {"text", "dm"},
        {"text", room_id},
        {"text", ""},
        {"uuid", created_by_bin},
        {"timestamp", now}
      ]
    )
  end

  defp ensure_room_member(room_id, user_id_bin, role, now) do
    Repo.execute(
      """
      INSERT INTO room_members (room_id, user_id, role, joined_at)
      VALUES (?, ?, ?, ?)
      IF NOT EXISTS
      """,
      [
        {"text", room_id},
        {"uuid", user_id_bin},
        {"text", role},
        {"timestamp", now}
      ]
    )
  end

  defp seed_user_room(room_id, user_id_bin, now) do
    Repo.execute(
      """
      INSERT INTO user_rooms (user_id, last_message_at, room_id, room_type, room_name, room_avatar, last_message, last_sender, unread_count, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """,
      [
        {"uuid", user_id_bin},
        {"timestamp", now},
        {"text", room_id},
        {"text", "dm"},
        {"text", room_id},
        {"text", ""},
        {"text", ""},
        {"uuid", user_id_bin},
        {"int", 0},
        {"boolean", false}
      ]
    )
  end
end
