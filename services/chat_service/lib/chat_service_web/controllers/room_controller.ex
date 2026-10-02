defmodule ChatServiceWeb.RoomController do
  use ChatServiceWeb, :controller

  alias ChatService.{Repo, RoomAccess}
  alias ChatServiceWeb.Endpoint

  require Logger

  def create(conn, params) do
    room_type = normalize_text(params["room_type"], "group")

    if room_type != "group" do
      conn |> put_status(:bad_request) |> json(%{error: "unsupported room_type"})
    else
      room_name = normalize_text(params["room_name"], "Group Chat")
      room_id = normalize_text(params["room_id"], "group:" <> Ecto.UUID.generate())
      current_user_id_bin = conn.assigns.current_user_id_bin

      members =
        params
        |> Map.get("member_ids", params["members"] || [])
        |> normalize_member_ids()
        |> then(&Enum.uniq([current_user_id_bin | &1]))

      now = DateTime.utc_now()

      with :ok <- validate_group_room_id(room_id),
           {:ok, _} <- create_room(room_id, room_type, room_name, current_user_id_bin, now),
           :ok <-
             execute_each(members, fn member_id ->
               role = if member_id == current_user_id_bin, do: "owner", else: "member"
               ensure_room_member(room_id, member_id, role, now)
             end),
           :ok <-
             execute_each(members, fn member_id ->
               seed_user_room(
                 room_id,
                 room_type,
                 room_name,
                 member_id,
                 current_user_id_bin,
                 now
               )
             end) do
        broadcast_inbox_updated(room_id, members)

        json(conn, %{
          data: %{
            room_id: room_id,
            room_name: room_name,
            room_type: room_type,
            members: Enum.map(members, &Ecto.UUID.cast!/1)
          }
        })
      else
        {:error, :invalid_room_id} ->
          conn |> put_status(:bad_request) |> json(%{error: "invalid group room_id"})

        {:error, :room_exists} ->
          conn |> put_status(:conflict) |> json(%{error: "room_id already exists"})

        _reason ->
          storage_unavailable(conn, "group room provisioning")
      end
    end
  end

  def add_members(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()

    if room_id == "" do
      conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
    else
      current_user_id_bin = conn.assigns.current_user_id_bin

      members =
        params
        |> Map.get("member_ids", params["members"] || [])
        |> normalize_member_ids()
        |> then(&Enum.uniq([current_user_id_bin | &1]))

      now = DateTime.utc_now()

      with {:ok, room} <- fetch_room_meta(room_id),
           :ok <- authorize_group_manager(room_id, current_user_id_bin, room),
           :ok <- ensure_group(room),
           :ok <-
             execute_each(members, fn member_id ->
               ensure_room_member(room_id, member_id, "member", now)
             end),
           :ok <-
             execute_each(members, fn member_id ->
               seed_user_room(
                 room_id,
                 room.room_type,
                 room.room_name,
                 member_id,
                 current_user_id_bin,
                 now
               )
             end) do
        broadcast_inbox_updated(room_id, members)

        json(conn, %{
          data: %{
            room_id: room_id,
            room_name: room.room_name,
            room_type: room.room_type,
            members: Enum.map(members, &Ecto.UUID.cast!/1)
          }
        })
      else
        {:error, :not_found} ->
          conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})

        {:error, :forbidden} ->
          conn |> put_status(:forbidden) |> json(%{error: "owner or admin role required"})

        {:error, :not_group} ->
          conn |> put_status(:bad_request) |> json(%{error: "room is not a group"})

        _reason ->
          storage_unavailable(conn, "group member provisioning")
      end
    end
  end

  def rename(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    room_name = normalize_text(params["room_name"], "")

    cond do
      room_id == "" ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
      room_name == "" or byte_size(room_name) > 120 ->
        conn |> put_status(:bad_request) |> json(%{error: "room_name must be 1-120 characters"})
      true ->
        current_user_id_bin = conn.assigns.current_user_id_bin
        with {:ok, room} <- fetch_room_meta(room_id),
             :ok <- authorize_group_manager(room_id, current_user_id_bin, room),
             :ok <- ensure_group(room),
             {:ok, members} <- fetch_room_members(room_id),
             :ok <- update_room_name(room_id, room_name),
             :ok <- execute_each(members, fn member_id -> update_user_room_name(room_id, member_id, room_name) end) do
          broadcast_inbox_updated(room_id, members)
          json(conn, %{data: %{room_id: room_id, room_name: room_name, room_type: room.room_type}})
        else
          {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
          {:error, :forbidden} -> conn |> put_status(:forbidden) |> json(%{error: "owner or admin role required"})
          {:error, :not_group} -> conn |> put_status(:bad_request) |> json(%{error: "room is not a group"})
          _reason -> storage_unavailable(conn, "group rename")
        end
    end
  end

  def remove_member(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    member_id_raw = normalize_text(params["member_id"], "")

    if room_id == "" or member_id_raw == "" do
      conn |> put_status(:bad_request) |> json(%{error: "room_id and member_id are required"})
    else
      current_user_id_bin = conn.assigns.current_user_id_bin

      with {:ok, room} <- fetch_room_meta(room_id),
           :ok <- authorize_group_manager(room_id, current_user_id_bin, room),
           :ok <- ensure_group(room),
           {:ok, member_id_bin} <- cast_member_id(member_id_raw),
           {:ok, role} <- room_member_role(room_id, member_id_bin),
           :ok <- ensure_removable_group_member(role),
           :ok <- delete_room_member(room_id, member_id_bin),
           :ok <- delete_user_room_state(room_id, member_id_bin) do
        broadcast_inbox_updated(room_id, [member_id_bin, current_user_id_bin])
        json(conn, %{data: %{room_id: room_id, removed_user_id: Ecto.UUID.cast!(member_id_bin)}})
      else
        {:error, :invalid_member_id} -> conn |> put_status(:bad_request) |> json(%{error: "invalid member_id"})
        {:error, :owner_cannot_be_removed} -> conn |> put_status(:conflict) |> json(%{error: "group owner cannot be removed"})
        {:error, :member_not_found} -> conn |> put_status(:not_found) |> json(%{error: "member not found"})
        {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
        {:error, :forbidden} -> conn |> put_status(:forbidden) |> json(%{error: "owner or admin role required"})
        {:error, :not_group} -> conn |> put_status(:bad_request) |> json(%{error: "room is not a group"})
        _reason -> storage_unavailable(conn, "group member removal")
      end
    end
  end

  def leave(conn, %{"room_id" => room_id_raw}) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    current_user_id_bin = conn.assigns.current_user_id_bin

    if room_id == "" do
      conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
    else
      with {:ok, room} <- fetch_room_meta(room_id),
           :ok <- ensure_group(room),
           {:ok, role} <- room_member_role(room_id, current_user_id_bin),
           :ok <- ensure_member_can_leave(role),
           :ok <- delete_room_member(room_id, current_user_id_bin),
           :ok <- delete_user_room_state(room_id, current_user_id_bin) do
        broadcast_inbox_updated(room_id, [current_user_id_bin])
        json(conn, %{data: %{room_id: room_id, left: true}})
      else
        {:error, :owner_cannot_leave} -> conn |> put_status(:conflict) |> json(%{error: "group owner must transfer ownership before leaving"})
        {:error, :not_member} -> conn |> put_status(:not_found) |> json(%{error: "member not found"})
        {:error, :not_found} -> conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})
        {:error, :not_group} -> conn |> put_status(:bad_request) |> json(%{error: "room is not a group"})
        _reason -> storage_unavailable(conn, "group leave")
      end
    end
  end

  def members(conn, %{"room_id" => room_id_raw}) do
    room_id = room_id_raw |> URI.decode() |> String.trim()
    current_user_id_bin = conn.assigns.current_user_id_bin

    if room_id == "" do
      conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
    else
      with {:ok, role} when is_binary(role) <- room_member_role(room_id, current_user_id_bin),
           {:ok, members} <- fetch_room_members(room_id) do
        json(conn, %{
          data: %{room_id: room_id, members: Enum.map(members, &Ecto.UUID.cast!/1)}
        })
      else
        {:ok, nil} ->
          conn |> put_status(:not_found) |> json(%{error: "room not found or access denied"})

        _reason ->
          storage_unavailable(conn, "room member lookup")
      end
    end
  end

  defp cast_member_id(value) when is_binary(value) do
    case Ecto.UUID.dump(value) do
      {:ok, binary} -> {:ok, binary}
      :error -> {:error, :invalid_member_id}
    end
  end

  defp cast_member_id(_value), do: {:error, :invalid_member_id}
  defp ensure_removable_group_member("owner"), do: {:error, :owner_cannot_be_removed}
  defp ensure_removable_group_member(nil), do: {:error, :member_not_found}
  defp ensure_removable_group_member(_role), do: :ok
  defp ensure_member_can_leave("owner"), do: {:error, :owner_cannot_leave}
  defp ensure_member_can_leave(nil), do: {:error, :not_member}
  defp ensure_member_can_leave(_role), do: :ok

  defp update_room_name(room_id, room_name) do
    case Repo.execute("UPDATE rooms SET room_name = ? WHERE room_id = ?", [{"text", room_name}, {"text", room_id}]) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp update_user_room_name(room_id, user_id_bin, room_name) do
    case Repo.execute("UPDATE user_room_state SET room_name = ? WHERE user_id = ? AND room_id = ?", [{"text", room_name}, {"uuid", user_id_bin}, {"text", room_id}]) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp delete_room_member(room_id, user_id_bin) do
    case Repo.execute("DELETE FROM room_members WHERE room_id = ? AND user_id = ?", [{"text", room_id}, {"uuid", user_id_bin}]) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp delete_user_room_state(room_id, user_id_bin) do
    case Repo.execute("DELETE FROM user_room_state WHERE user_id = ? AND room_id = ?", [{"uuid", user_id_bin}, {"text", room_id}]) do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp normalize_text(value, default) when is_binary(value) do
    case String.trim(value) do
      "" -> default
      normalized -> normalized
    end
  end

  defp normalize_text(_value, default), do: default

  defp normalize_member_ids(nil), do: []

  defp normalize_member_ids(ids) when is_list(ids) do
    ids
    |> Enum.filter(&is_binary/1)
    |> Enum.reduce([], fn id, acc ->
      case Ecto.UUID.dump(id) do
        {:ok, binary} -> [binary | acc]
        :error -> acc
      end
    end)
    |> Enum.uniq()
  end

  defp normalize_member_ids(id) when is_binary(id), do: normalize_member_ids([id])
  defp normalize_member_ids(_), do: []

  defp validate_group_room_id(room_id) do
    if String.starts_with?(room_id, "group:") and byte_size(room_id) <= 255 do
      :ok
    else
      {:error, :invalid_room_id}
    end
  end

  defp create_room(room_id, room_type, room_name, created_by_bin, now) do
    result =
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

    case result do
      {:ok, rows} = success ->
        if lwt_applied?(rows), do: success, else: {:error, :room_exists}

      error ->
        error
    end
  end

  defp lwt_applied?(rows) do
    case Enum.to_list(rows) do
      [row | _] when is_map(row) -> Map.get(row, "[applied]", true) != false
      _ -> true
    end
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
      INSERT INTO user_room_state (user_id, room_id, last_message_at, room_type, room_name, room_avatar, last_message, last_sender, unread_count, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      IF NOT EXISTS
      """,
      [
        {"uuid", user_id_bin},
        {"text", room_id},
        {"timestamp", now},
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

  defp execute_each(values, operation) do
    Enum.reduce_while(values, :ok, fn value, :ok ->
      case operation.(value) do
        {:ok, _result} -> {:cont, :ok}
        {:error, _reason} = error -> {:halt, error}
        other -> {:halt, {:error, other}}
      end
    end)
  end

  defp fetch_room_members(room_id) do
    case Repo.execute("SELECT user_id FROM room_members WHERE room_id = ?", [{"text", room_id}]) do
      {:ok, rows} ->
        members =
          rows
          |> Enum.to_list()
          |> Enum.map(& &1["user_id"])
          |> Enum.filter(&is_binary/1)

        {:ok, members}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp fetch_room_meta(room_id) do
    case Repo.execute(
           "SELECT room_type, room_name, room_avatar, created_by FROM rooms WHERE room_id = ? LIMIT 1",
           [{"text", room_id}]
         ) do
      {:ok, rows} ->
        case Enum.to_list(rows) do
          [row | _] ->
            {:ok,
             %{
               room_type: row["room_type"] || "dm",
               room_name: row["room_name"] || room_id,
               room_avatar: row["room_avatar"] || "",
               created_by: row["created_by"]
             }}

          [] ->
            {:error, :not_found}
        end

      {:error, reason} ->
        {:error, {:storage, reason}}
    end
  end

  defp room_member_role(room_id, user_id_bin) do
    case Repo.execute(
           "SELECT role FROM room_members WHERE room_id = ? AND user_id = ? LIMIT 1",
           [{"text", room_id}, {"uuid", user_id_bin}]
         ) do
      {:ok, rows} ->
        case Enum.to_list(rows) do
          [row | _] -> {:ok, row["role"]}
          [] -> {:ok, nil}
        end

      {:error, reason} ->
        {:error, {:storage, reason}}
    end
  end

  defp authorize_group_manager(room_id, current_user_id_bin, room) do
    case room_member_role(room_id, current_user_id_bin) do
      {:ok, nil} ->
        {:error, :not_found}

      {:ok, role} ->
        if RoomAccess.manager_role?(role) or room.created_by == current_user_id_bin do
          :ok
        else
          {:error, :forbidden}
        end

      {:error, _reason} = error ->
        error
    end
  end

  defp ensure_group(%{room_type: "group"}), do: :ok
  defp ensure_group(_room), do: {:error, :not_group}

  defp broadcast_inbox_updated(room_id, members) do
    Enum.each(members, fn member_id_bin ->
      topic = "user:" <> Ecto.UUID.cast!(member_id_bin)
      Endpoint.broadcast!(topic, "inbox_updated", %{room_id: room_id})
    end)
  end

  defp storage_unavailable(conn, operation) do
    Logger.error("Chat storage unavailable during #{operation}")

    conn
    |> put_status(:service_unavailable)
    |> json(%{error: "chat storage unavailable"})
  end
end
