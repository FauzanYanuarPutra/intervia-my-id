defmodule ChatServiceWeb.InboxController do
  use ChatServiceWeb, :controller

  alias ChatService.Repo
  alias ChatService.DmRoom

  # Fetch more rows then dedupe by room_id so we show one room per conversation (not one row per message).
  @inbox_fetch_limit 500
  @inbox_return_limit 100

  def index(conn, params) do
    user_id_bin = conn.assigns.current_user_id_bin
    limit =
      params
      |> Map.get("limit", "30")
      |> to_int(30)
      |> min(@inbox_return_limit)
      |> max(1)

    query = "SELECT * FROM user_rooms WHERE user_id = ? ORDER BY last_message_at DESC LIMIT ?"

    case Repo.execute(query, [{"uuid", user_id_bin}, {"int", @inbox_fetch_limit}]) do
      {:ok, rows} ->
        unread_map = fetch_unread_map(user_id_bin)

        # Deduplicate by room_id: keep the row with latest last_message_at (first in DESC order).
        {unique_rows, _seen} =
          Enum.reduce(Enum.to_list(rows), {[], MapSet.new()}, fn row, {acc, seen} ->
            rid = row["room_id"]
            if MapSet.member?(seen, rid) do
              {acc, seen}
            else
              {[row | acc], MapSet.put(seen, rid)}
            end
          end)
        unique_rows =
          unique_rows
          |> Enum.sort_by(
            fn row ->
              case row["last_message_at"] do
                %DateTime{} = dt -> DateTime.to_unix(dt, :microsecond)
                %NaiveDateTime{} = ndt ->
                  ndt
                  |> DateTime.from_naive!("Etc/UTC")
                  |> DateTime.to_unix(:microsecond)
                _ -> 0
              end
            end,
            :desc
          )
          |> Enum.take(limit)

        data =
          Enum.map(unique_rows, fn row ->
            room_id = row["room_id"]
            room_type = row["room_type"] || "dm"
            {resolved_name, room_avatar} = resolve_room_display(room_id, room_type, user_id_bin)
            room_name = resolved_name || row["room_name"] || room_id
            last_sender = row["last_sender"]
            unread_from_counter = to_nonneg_int(Map.get(unread_map, room_id))
            unread_from_snapshot = to_nonneg_int(row["unread_count"])
            unread_raw = max(unread_from_counter, unread_from_snapshot)
            unread_count = if same_uuid_bin?(last_sender, user_id_bin), do: 0, else: unread_raw

            %{
              room_id: room_id,
              room_type: room_type,
              room_name: room_name,
              room_avatar: room_avatar,
              last_message: row["last_message"],
              last_sender: last_sender,
              last_message_at: row["last_message_at"],
              unread_count: unread_count,
              is_pinned: row["is_pinned"] || false
            }
          end)

        json(conn, %{data: data})

      _ ->
        conn |> put_status(:internal_server_error) |> json(%{error: "db error"})
    end
  end

  defp resolve_room_display(room_id, "dm", user_id_bin) do
    case DmRoom.peer_user_id_bin(room_id, user_id_bin) do
      nil -> {room_id, nil}
      peer_id_bin -> get_user_display(peer_id_bin)
    end
  end
  defp resolve_room_display(_room_id, _type, _user_id_bin), do: {nil, nil}

  defp get_user_display(user_id_bin) do
    case Repo.execute("SELECT display_name, username, avatar_url FROM users WHERE user_id = ? LIMIT 1", [{"uuid", user_id_bin}]) do
      {:ok, [row | _]} ->
        name = row["display_name"] || row["username"] || Ecto.UUID.cast!(user_id_bin)
        {name, row["avatar_url"]}
      _ ->
        {Ecto.UUID.cast!(user_id_bin), nil}
    end
  end

  defp to_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {v, _} -> v
      _ -> default
    end
  end

  defp to_int(value, _default) when is_integer(value), do: value
  defp to_int(_, default), do: default

  defp to_nonneg_int(value) when is_integer(value), do: max(value, 0)
  defp to_nonneg_int(_), do: 0

  defp same_uuid_bin?(left, right) when is_binary(left) and is_binary(right), do: left == right
  defp same_uuid_bin?(_, _), do: false

  defp fetch_unread_map(user_id_bin) do
    case Repo.execute("SELECT room_id, unread FROM unread_counters WHERE user_id = ?", [{"uuid", user_id_bin}]) do
      {:ok, rows} ->
        Enum.reduce(rows, %{}, fn row, acc ->
          room_id = row["room_id"]
          unread = to_nonneg_int(row["unread"])
          if is_binary(room_id) and room_id != "" do
            Map.put(acc, room_id, unread)
          else
            acc
          end
        end)

      _ ->
        %{}
    end
  end
end

