defmodule ChatServiceWeb.SupportRoomController do
  use ChatServiceWeb, :controller

  alias ChatService.{AidaBot, Repo}

  require Logger

  @support_roles ~w(admin super_admin support ops agent sales)
  @support_perms ~w(support:chat support:manage support:rooms chat:join)

  def create(conn, params) do
    room_id =
      case params["room_id"] do
        v when is_binary(v) -> String.trim(v)
        _ -> ""
      end

    room_name =
      case params["room_name"] do
        v when is_binary(v) -> String.trim(v)
        _ -> ""
      end

    room_name =
      if room_name == "" do
        if room_id == AidaBot.support_room_id(), do: AidaBot.bot_name(), else: room_id
      else
        room_name
      end

    if room_id == "" or not String.starts_with?(room_id, "support:") do
      conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
    else
      current_user_id_bin = conn.assigns.current_user_id_bin
      roles = conn.assigns.current_user_roles || []
      perms = conn.assigns.current_user_perms || []
      is_agent = support_agent?(roles, perms)

      members =
        params
        |> Map.get("member_ids", params["members"] || [])
        |> normalize_member_ids()

      members =
        if members == [] do
          [current_user_id_bin]
        else
          if is_agent do
            Enum.uniq([current_user_id_bin | members])
          else
            [current_user_id_bin]
          end
        end

      members = maybe_include_support_bot(room_id, members)

      now = DateTime.utc_now()

      case provision_room(room_id, room_name, members, current_user_id_bin, now) do
        :ok ->
          json(conn, %{
            data: %{
              room_id: room_id,
              room_name: room_name,
              members: Enum.map(members, &Ecto.UUID.cast!/1)
            }
          })

        {:error, _reason} ->
          storage_unavailable(conn)
      end
    end
  end

  def add_members(conn, %{"room_id" => room_id_raw} = params) do
    room_id = room_id_raw |> URI.decode() |> String.trim()

    room_name =
      case params["room_name"] do
        v when is_binary(v) -> String.trim(v)
        _ -> ""
      end

    room_name =
      if room_name == "" do
        if room_id == AidaBot.support_room_id(), do: AidaBot.bot_name(), else: room_id
      else
        room_name
      end

    if room_id == "" or not String.starts_with?(room_id, "support:") do
      conn |> put_status(:bad_request) |> json(%{error: "invalid room_id"})
    else
      current_user_id_bin = conn.assigns.current_user_id_bin
      roles = conn.assigns.current_user_roles || []
      perms = conn.assigns.current_user_perms || []
      is_agent = support_agent?(roles, perms)

      members =
        params
        |> Map.get("member_ids", params["members"] || [])
        |> normalize_member_ids()

      members =
        cond do
          members == [] -> [current_user_id_bin]
          is_agent -> Enum.uniq([current_user_id_bin | members])
          true -> [current_user_id_bin]
        end

      members = maybe_include_support_bot(room_id, members)

      now = DateTime.utc_now()

      case provision_room(room_id, room_name, members, current_user_id_bin, now) do
        :ok ->
          json(conn, %{
            data: %{
              room_id: room_id,
              room_name: room_name,
              members: Enum.map(members, &Ecto.UUID.cast!/1)
            }
          })

        {:error, _reason} ->
          storage_unavailable(conn)
      end
    end
  end

  defp support_agent?(roles, perms) do
    role_match =
      roles
      |> Enum.map(&String.downcase/1)
      |> Enum.any?(&(&1 in @support_roles))

    perm_match =
      perms
      |> Enum.map(&String.downcase/1)
      |> Enum.any?(&(&1 in @support_perms))

    role_match or perm_match
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

  defp maybe_include_support_bot(room_id, members) do
    if is_binary(room_id) and String.starts_with?(room_id, "support:") do
      case Ecto.UUID.dump(AidaBot.bot_id()) do
        {:ok, bot_id_bin} -> Enum.uniq([bot_id_bin | members])
        :error -> members
      end
    else
      members
    end
  end

  defp ensure_room(room_id, room_name, created_by_bin, now) do
    Repo.execute(
      """
      INSERT INTO rooms (room_id, room_type, room_name, room_avatar, created_by, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      IF NOT EXISTS
      """,
      [
        {"text", room_id},
        {"text", "support"},
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

  defp seed_user_room(room_id, room_name, user_id_bin, sender_id_bin, now) do
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
        {"text", "support"},
        {"text", room_name},
        {"text", ""},
        {"text", ""},
        {"uuid", sender_id_bin},
        {"int", 0},
        {"boolean", false}
      ]
    )
  end

  defp provision_room(room_id, room_name, members, current_user_id_bin, now) do
    with {:ok, _} <- ensure_room(room_id, room_name, current_user_id_bin, now),
         :ok <-
           execute_each(members, fn member_id ->
             ensure_room_member(room_id, member_id, "member", now)
           end),
         :ok <-
           execute_each(members, fn member_id ->
             seed_user_room(room_id, room_name, member_id, current_user_id_bin, now)
           end) do
      :ok
    end
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

  defp storage_unavailable(conn) do
    Logger.error("Support room provisioning failed because chat storage was unavailable")

    conn
    |> put_status(:service_unavailable)
    |> json(%{error: "chat storage unavailable"})
  end
end
