defmodule ChatServiceWeb.DmController do
  use ChatServiceWeb, :controller

  alias ChatService.{DmRoom, Repo, TrustSafety}

  require Logger

  def create(conn, %{"peer_user_id" => peer_user_id}) when is_binary(peer_user_id) do
    user_id_bin = conn.assigns.current_user_id_bin

    with {:ok, peer_id_bin} <- Ecto.UUID.dump(peer_user_id),
         :ok <- DmRoom.validate_not_self(user_id_bin, peer_id_bin),
         :ok <- TrustSafety.ensure_not_blocked(user_id_bin, peer_id_bin) do
      room_id = DmRoom.build_room_id(user_id_bin, peer_id_bin)
      now = DateTime.utc_now()

      with {:ok, _} <- ensure_room(room_id, user_id_bin, now),
           {:ok, _} <- ensure_room_member(room_id, user_id_bin, "owner", now),
           {:ok, _} <- ensure_room_member(room_id, peer_id_bin, "member", now),
           {:ok, _} <- seed_user_room(room_id, user_id_bin, now),
           {:ok, _} <- seed_user_room(room_id, peer_id_bin, now) do
        json(conn, %{data: %{room_id: room_id}})
      else
        _reason -> storage_unavailable(conn)
      end
    else
      {:error, :self_chat} ->
        conn |> put_status(:bad_request) |> json(%{error: "cannot chat with yourself"})

      {:error, :blocked} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "conversation unavailable", code: "contact_blocked"})

      {:error, :storage_unavailable} ->
        storage_unavailable(conn)

      :error ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid peer_user_id"})

      _reason ->
        storage_unavailable(conn)
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
      INSERT INTO user_room_state (user_id, room_id, last_message_at, room_type, room_name, room_avatar, last_message, last_sender, unread_count, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      IF NOT EXISTS
      """,
      [
        {"uuid", user_id_bin},
        {"text", room_id},
        {"timestamp", now},
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

  defp storage_unavailable(conn) do
    Logger.error("DM room provisioning failed because chat storage was unavailable")

    conn
    |> put_status(:service_unavailable)
    |> json(%{error: "chat storage unavailable"})
  end
end
