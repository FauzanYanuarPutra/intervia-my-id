defmodule ChatServiceWeb.InboxController do
  use ChatServiceWeb, :controller

  alias ChatService.{IdentityClient, Repo}
  alias ChatService.DmRoom

  # Keep legacy reads during the rolling migration to user_room_state. The
  # canonical table has one row per room; legacy user_rooms has one per message.
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

    case fetch_inbox_rows(user_id_bin) do
      {:ok, rows} ->
        unread_map = fetch_unread_map(user_id_bin)

        unique_rows =
          rows
          |> newest_row_per_room()
          |> Enum.sort_by(&row_timestamp/1, :desc)
          |> Enum.take(limit)

        data =
          Enum.map(unique_rows, fn row ->
            room_id = row["room_id"]
            room_type = row["room_type"] || "dm"

            {resolved_name, room_avatar, room_avatar_style} =
              resolve_room_display(room_id, room_type, user_id_bin)

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
              avatar_style: room_avatar_style,
              room_avatar_style: room_avatar_style,
              last_message: row["last_message"],
              last_sender: last_sender,
              last_message_at: row["last_message_at"],
              unread_count: unread_count,
              is_pinned: row["is_pinned"] || false
            }
          end)

        json(conn, %{data: data})

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{error: "chat storage unavailable"})
    end
  end

  defp fetch_inbox_rows(user_id_bin) do
    current =
      Repo.execute(
        "SELECT * FROM user_room_state WHERE user_id = ?",
        [{"uuid", user_id_bin}]
      )

    legacy =
      Repo.execute(
        "SELECT * FROM user_rooms WHERE user_id = ? ORDER BY last_message_at DESC LIMIT ?",
        [{"uuid", user_id_bin}, {"int", @inbox_fetch_limit}]
      )

    case {rows_from(current), rows_from(legacy)} do
      {{:ok, current_rows}, {:ok, legacy_rows}} -> {:ok, current_rows ++ legacy_rows}
      {{:ok, current_rows}, {:error, _}} -> {:ok, current_rows}
      {{:error, _}, {:ok, legacy_rows}} -> {:ok, legacy_rows}
      {{:error, reason}, {:error, _}} -> {:error, reason}
    end
  end

  defp rows_from({:ok, rows}), do: {:ok, Enum.to_list(rows)}
  defp rows_from({:error, reason}), do: {:error, reason}
  defp rows_from(other), do: {:error, other}

  defp newest_row_per_room(rows) do
    rows
    |> Enum.reduce(%{}, fn row, acc ->
      case row["room_id"] do
        room_id when is_binary(room_id) and room_id != "" ->
          Map.update(acc, room_id, row, fn current ->
            prefer_inbox_row(row, current)
          end)

        _ ->
          acc
      end
    end)
    |> Map.values()
  end

  # During the rolling migration, an idempotent room-open may seed an empty
  # canonical row after a real legacy message. Preserve the meaningful legacy
  # state until the first canonical message projection arrives.
  defp prefer_inbox_row(candidate, current) do
    case {meaningful_message?(candidate), meaningful_message?(current)} do
      {true, false} -> candidate
      {false, true} -> current

      _ ->
        if row_timestamp(candidate) > row_timestamp(current), do: candidate, else: current
    end
  end

  defp meaningful_message?(row) do
    case row["last_message"] do
      message when is_binary(message) -> String.trim(message) != ""
      _ -> false
    end
  end

  defp row_timestamp(row) do
    case row["last_message_at"] do
      %DateTime{} = datetime ->
        DateTime.to_unix(datetime, :microsecond)

      %NaiveDateTime{} = datetime ->
        datetime
        |> DateTime.from_naive!("Etc/UTC")
        |> DateTime.to_unix(:microsecond)

      _ ->
        0
    end
  end

  defp resolve_room_display(room_id, "dm", user_id_bin) do
    case DmRoom.peer_user_id_bin(room_id, user_id_bin) do
      nil -> {room_id, nil, nil}
      peer_id_bin -> get_user_display(peer_id_bin)
    end
  end

  defp resolve_room_display(_room_id, _type, _user_id_bin), do: {nil, nil, nil}

  defp get_user_display(user_id_bin) do
    user_id = Ecto.UUID.cast!(user_id_bin)

    case local_user_display(user_id_bin, user_id) do
      {:ok, display} ->
        display

      :miss ->
        case IdentityClient.fetch_public_profile(user_id) do
          {:ok, profile} ->
            name = IdentityClient.display_name(profile, user_id) || user_id
            {name, IdentityClient.avatar_url(profile), IdentityClient.avatar_style(profile)}

          _ ->
            {user_id, nil, nil}
        end
    end
  end

  # The local identity projection is populated when users connect and avoids a
  # sequential network request for every DM in a large inbox.
  defp local_user_display(user_id_bin, user_id) do
    case Repo.execute(
           "SELECT display_name, username, avatar_url FROM users WHERE user_id = ? LIMIT 1",
           [{"uuid", user_id_bin}]
         ) do
      {:ok, rows} ->
        case Enum.take(rows, 1) do
          [row] ->
            name = row["display_name"] || row["username"] || user_id
            {:ok, {name, row["avatar_url"], nil}}

          [] ->
            :miss
        end

      _ ->
        :miss
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
    case Repo.execute("SELECT room_id, unread FROM unread_counters WHERE user_id = ?", [
           {"uuid", user_id_bin}
         ]) do
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
