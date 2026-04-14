defmodule ChatServiceWeb.RoomController do
  use ChatServiceWeb, :controller

  alias ChatService.Repo
  alias ChatServiceWeb.Endpoint

  def create(conn, params) do
    room_type =
      case params["room_type"] do
        v when is_binary(v) -> String.trim(v)
        _ -> "group"
      end

    if room_type != "group" do
      conn |> put_status(:bad_request) |> json(%{error: "unsupported room_type"})
    else
      room_name =
        case params["room_name"] do
          v when is_binary(v) -> String.trim(v)
          _ -> ""
        end

      room_id =
        case params["room_id"] do
          v when is_binary(v) -> String.trim(v)
          _ -> ""
        end

      room_id =
        if room_id == "" do
          "group:" <> Ecto.UUID.generate()
        else
          room_id
        end

      room_name = if room_name == "", do: "Group Chat", else: room_name

      current_user_id_bin = conn.assigns.current_user_id_bin

      members =
        params
        |> Map.get("member_ids", params["members"] || [])
        |> normalize_member_ids()

      members = Enum.uniq([current_user_id_bin | members])

      now = DateTime.utc_now()
      ensure_room(room_id, room_type, room_name, current_user_id_bin, now)
      Enum.each(members, &ensure_room_member(room_id, &1, "member", now))
      Enum.each(members, &seed_user_room(room_id, room_type, room_name, &1, current_user_id_bin, now))

      broadcast_inbox_updated(room_id, members)

      json(conn, %{
        data: %{
          room_id: room_id,
          room_name: room_name,
          room_type: room_type,
          members: Enum.map(members, &Ecto.UUID.cast!/1)
        }
      })
    end
  end

  def add_members(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()

    if room_id == "" do
      conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
    else
      current_user_id_bin = conn.assigns.current_user_id_bin

      if not room_member?(room_id, current_user_id_bin) do
        conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
      else
        {room_type, room_name, _avatar} = fetch_room_meta(room_id)

        if room_type != "group" do
          conn |> put_status(:bad_request) |> json(%{error: "room is not a group"})
        else
          members =
            params
            |> Map.get("member_ids", params["members"] || [])
            |> normalize_member_ids()

          members = Enum.uniq([current_user_id_bin | members])

          now = DateTime.utc_now()
          Enum.each(members, &ensure_room_member(room_id, &1, "member", now))
          Enum.each(members, &seed_user_room(room_id, room_type, room_name, &1, current_user_id_bin, now))

          broadcast_inbox_updated(room_id, members)

          json(conn, %{
            data: %{
              room_id: room_id,
              room_name: room_name,
              room_type: room_type,
              members: Enum.map(members, &Ecto.UUID.cast!/1)
            }
          })
        end
      end
    end
  end

  def members(conn, %{"room_id" => room_id_raw}) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    current_user_id_bin = conn.assigns.current_user_id_bin

    if room_id == "" do
      conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
    else
      if not room_member?(room_id, current_user_id_bin) do
        conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
      else
        members = fetch_room_members(room_id)
        json(conn, %{data: %{room_id: room_id, members: Enum.map(members, &Ecto.UUID.cast!/1)}})
      end
    end
  end

  defp normalize_member_ids(nil), do: []

  defp normalize_member_ids(ids) when is_list(ids) do
    ids
    |> Enum.filter(&is_binary/1)
    |> Enum.reduce([], fn id, acc ->
      case Ecto.UUID.dump(id) do
        {:ok, bin} -> [bin | acc]
        :error -> acc
      end
    end)
    |> Enum.uniq()
  end

  defp normalize_member_ids(id) when is_binary(id), do: normalize_member_ids([id])
  defp normalize_member_ids(_), do: []

  defp ensure_room(room_id, room_type, room_name, created_by_bin, now) do
    Repo.execute(
      """
      INSERT INTO rooms (room_id, room_type, room_name, room_avatar, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      IF NOT EXISTS
      """,
      [
        {"text", room_id},
        {"text", room_type},
        {"text", room_name},
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

  defp seed_user_room(room_id, room_type, room_name, user_id_bin, sender_id_bin, now) do
    Repo.execute(
      """
      INSERT INTO user_rooms (user_id, last_message_at, room_id, room_type, room_name, room_avatar, last_message, last_sender, unread_count, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      """,
      [
        {"uuid", user_id_bin},
        {"timestamp", now},
        {"text", room_id},
        {"text", room_type},
        {"text", room_name},
        {"text", ""},
        {"text", ""},
        {"uuid", sender_id_bin},
        {"int", 0},
        {"boolean", false}
      ]
    )
  end

  defp fetch_room_members(room_id) do
    case Repo.execute("SELECT user_id FROM room_members WHERE room_id = ?", [{"text", room_id}]) do
      {:ok, %{rows: rows}} -> Enum.map(rows, fn [user_id] -> user_id end)
      _ -> []
    end
  end

  defp fetch_room_meta(room_id) do
    case Repo.execute(
           "SELECT room_type, room_name, room_avatar FROM rooms WHERE room_id = ? LIMIT 1",
           [{"text", room_id}]
         ) do
      {:ok, %{rows: [[room_type, room_name, room_avatar] | _]}} ->
        {room_type || "dm", room_name || room_id, room_avatar || ""}

      _ ->
        {"dm", room_id, ""}
    end
  end

  defp room_member?(room_id, user_id_bin) do
    case Repo.execute(
           "SELECT user_id FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
           [{"text", room_id}, {"uuid", user_id_bin}]
         ) do
      {:ok, %{rows: [_ | _]}} -> true
      _ -> false
    end
  end

  defp broadcast_inbox_updated(room_id, members) do
    Enum.each(members, fn member_id_bin ->
      topic = "user:" <> Ecto.UUID.cast!(member_id_bin)
      Endpoint.broadcast!(topic, "inbox_updated", %{room_id: room_id})
    end)
  end
end
