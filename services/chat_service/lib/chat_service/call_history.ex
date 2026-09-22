defmodule ChatService.CallHistory do
  @moduledoc false

  alias ChatService.Repo

  @history_buckets 18
  @missed_after_seconds 45

  def start(call_id, room_id, caller_id_bin, call_type) do
    with {:ok, members} <- room_members(room_id),
         {:ok, callee_id_bin} <- peer_member(members, caller_id_bin),
         {:ok, started_at} <-
           insert_record(call_id, room_id, caller_id_bin, callee_id_bin, call_type),
         :ok <-
           insert_user_rows(
             call_id,
             room_id,
             caller_id_bin,
             callee_id_bin,
             call_type,
             started_at
           ) do
      {:ok, started_at}
    end
  end

  def accept(call_id, actor_user_id_bin) do
    update_from_record(call_id, fn record, now ->
      cond do
        record["callee_id"] != actor_user_id_bin ->
          {:error, :forbidden}

        record["status"] != "ringing" ->
          {:error, :call_no_longer_available}

        true ->
          update_record(record, "connecting", nil, nil, now, nil)
      end
    end)
  end

  def connected(call_id) do
    update_from_record(call_id, fn record, now ->
      if record["status"] in ["connecting", "connected"] do
        connected_at = record["connected_at"] || now
        update_record(record, "connected", connected_at, nil, now, nil)
      else
        {:error, :call_no_longer_available}
      end
    end)
  end

  def reject(call_id, actor_user_id_bin, reason \\ "rejected") do
    update_from_record(call_id, fn record, now ->
      cond do
        record["callee_id"] != actor_user_id_bin ->
          {:error, :forbidden}

        record["status"] != "ringing" ->
          {:error, :call_no_longer_available}

        true ->
          update_record(record, "declined", nil, now, now, reason)
      end
    end)
  end

  def timeout(call_id, reason \\ "timeout") do
    update_from_record(call_id, fn record, now ->
      if (record["status"] || "ringing") == "ringing" do
        update_record(record, "missed", nil, now, now, reason)
      else
        record
      end
    end)
  end

  def end_call(call_id, user_id_bin, reason \\ "ended") do
    update_from_record(call_id, fn record, now ->
      current_status = record["status"] || "ringing"
      caller_id = record["caller_id"]

      if current_status in ["completed", "cancelled", "declined", "missed", "failed"] do
        record
      else
        status =
          cond do
            current_status in ["connected", "connecting"] ->
              "completed"

            caller_id == user_id_bin ->
              "cancelled"

            true ->
              "missed"
          end

        duration_seconds =
          case {record["connected_at"], now} do
            {%DateTime{} = connected_at, %DateTime{} = ended_at} ->
              max(DateTime.diff(ended_at, connected_at, :second), 0)

            _ ->
              0
          end

        update_record(record, status, record["connected_at"], now, now, reason)
        |> Map.put("duration_seconds", duration_seconds)
      end
    end)
  end

  def get_for_user(call_id, user_id_bin) do
    case Repo.execute(
           "SELECT * FROM call_records_by_id WHERE call_id = ? LIMIT 1",
           [{"uuid", call_id}]
         ) do
      {:ok, [record | _]} ->
        if record["caller_id"] == user_id_bin or record["callee_id"] == user_id_bin do
          {:ok,
           %{
             call_id: uuid_to_string(record["call_id"]),
             room_id: record["room_id"],
             caller_id: uuid_to_string(record["caller_id"]),
             callee_id: uuid_to_string(record["callee_id"]),
             call_type: normalize_call_type(record["call_type"]),
             status: normalize_status(record["status"]),
             started_at: iso(record["started_at"]),
             connected_at: iso(record["connected_at"]),
             ended_at: iso(record["ended_at"]),
             duration_seconds: max(to_int(record["duration_seconds"]), 0),
             end_reason: record["end_reason"]
           }}
        else
          {:error, :forbidden}
        end

      {:ok, []} ->
        {:error, :not_found}

      {:error, reason} ->
        {:error, reason}
    end
  end

  def list_for_user(user_id_bin, limit \\ 100) do
    buckets = recent_buckets(@history_buckets)

    rows =
      Enum.flat_map(buckets, fn bucket ->
        case Repo.execute(
               "SELECT * FROM call_history_by_user WHERE user_id = ? AND bucket = ?",
               [{"uuid", user_id_bin}, {"int", bucket}]
             ) do
          {:ok, bucket_rows} -> bucket_rows
          _ -> []
        end
      end)

    data =
      rows
      |> Enum.map(&normalize_history_row/1)
      |> Enum.map(&mark_stale_ringing/1)
      |> Enum.sort_by(&timestamp_sort_key/1, :desc)
      |> Enum.take(limit)

    {:ok, data}
  end

  defp update_from_record(call_id, updater) do
    case Repo.execute(
           "SELECT * FROM call_records_by_id WHERE call_id = ? LIMIT 1",
           [{"uuid", call_id}]
         ) do
      {:ok, [record | _]} ->
        now = DateTime.utc_now()

        case updater.(record, now) do
          {:error, reason} ->
            {:error, reason}

          updated ->
            with :ok <- persist_record(updated),
                 :ok <- sync_user_rows(updated) do
              {:ok, updated}
            end
        end

      {:ok, []} ->
        {:error, :call_not_found}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp insert_record(call_id, room_id, caller_id_bin, callee_id_bin, call_type) do
    started_at = DateTime.utc_now()
    bucket = bucket(started_at)

    case Repo.execute(
           """
           INSERT INTO call_records_by_id
             (call_id, room_id, caller_id, callee_id, call_type, bucket, started_at, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           """,
           [
             {"uuid", call_id},
             {"text", room_id},
             {"uuid", caller_id_bin},
             {"uuid", callee_id_bin},
             {"text", call_type},
             {"int", bucket},
             {"timestamp", started_at},
             {"text", "ringing"}
           ]
         ) do
      {:ok, _} -> {:ok, started_at}
      {:error, reason} -> {:error, reason}
    end
  end

  defp insert_user_rows(call_id, room_id, caller_id_bin, callee_id_bin, call_type, started_at) do
    bucket_value = bucket(started_at)

    rows = [
      {caller_id_bin, callee_id_bin},
      {callee_id_bin, caller_id_bin}
    ]

    Enum.reduce_while(rows, :ok, fn {user_id, peer_id}, :ok ->
      case Repo.execute(
             """
             INSERT INTO call_history_by_user
               (user_id, bucket, call_id, room_id, peer_user_id, caller_user_id, call_type, status, started_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             """,
             [
               {"uuid", user_id},
               {"int", bucket_value},
               {"uuid", call_id},
               {"text", room_id},
               {"uuid", peer_id},
               {"uuid", caller_id_bin},
               {"text", call_type},
               {"text", "ringing"},
               {"timestamp", started_at}
             ]
           ) do
        {:ok, _} -> {:cont, :ok}
        {:error, reason} -> {:halt, {:error, reason}}
      end
    end)
  end

  defp persist_record(record) do
    Repo.execute(
      """
      UPDATE call_records_by_id
      SET status = ?, connected_at = ?, ended_at = ?, duration_seconds = ?, end_reason = ?
      WHERE call_id = ?
      """,
      [
        {"text", record["status"]},
        {"timestamp", record["connected_at"]},
        {"timestamp", record["ended_at"]},
        {"int", record["duration_seconds"] || 0},
        {"text", record["end_reason"]},
        {"uuid", record["call_id"]}
      ]
    )
    |> case do
      {:ok, _} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp sync_user_rows(record) do
    bucket_value = record["bucket"]
    status = record["status"] || "ringing"

    [record["caller_id"], record["callee_id"]]
    |> Enum.filter(&is_binary/1)
    |> Enum.reduce_while(:ok, fn user_id, :ok ->
      peer_id =
        if user_id == record["caller_id"], do: record["callee_id"], else: record["caller_id"]

      case Repo.execute(
             """
             UPDATE call_history_by_user
             SET status = ?, connected_at = ?, ended_at = ?, duration_seconds = ?, end_reason = ?
             WHERE user_id = ? AND bucket = ? AND call_id = ?
             """,
             [
               {"text", status},
               {"timestamp", record["connected_at"]},
               {"timestamp", record["ended_at"]},
               {"int", record["duration_seconds"] || 0},
               {"text", record["end_reason"]},
               {"uuid", user_id},
               {"int", bucket_value},
               {"uuid", record["call_id"]}
             ]
           ) do
        {:ok, _} ->
          _ = peer_id
          {:cont, :ok}

        {:error, reason} ->
          {:halt, {:error, reason}}
      end
    end)
  end

  defp update_record(record, status, connected_at, ended_at, _now, reason) do
    record
    |> Map.put("status", status)
    |> Map.put("connected_at", connected_at)
    |> Map.put("ended_at", ended_at)
    |> Map.put("end_reason", reason)
    |> Map.put_new("duration_seconds", 0)
  end

  defp normalize_history_row(row) do
    %{
      call_id: uuid_to_string(row["call_id"]),
      room_id: row["room_id"],
      peer_user_id: uuid_to_string(row["peer_user_id"]),
      caller_user_id: uuid_to_string(row["caller_user_id"]),
      call_type: normalize_call_type(row["call_type"]),
      status: normalize_status(row["status"]),
      started_at: iso(row["started_at"]),
      connected_at: iso(row["connected_at"]),
      ended_at: iso(row["ended_at"]),
      duration_seconds: max(to_int(row["duration_seconds"]), 0),
      end_reason: row["end_reason"]
    }
  end

  defp mark_stale_ringing(item) do
    if item.status == "ringing" and expired?(item.started_at) do
      %{item | status: "missed", end_reason: "timeout"}
    else
      item
    end
  end

  defp expired?(nil), do: false

  defp expired?(iso_timestamp) do
    case DateTime.from_iso8601(iso_timestamp) do
      {:ok, started_at, _offset} ->
        DateTime.diff(DateTime.utc_now(), started_at, :second) >= @missed_after_seconds

      _ ->
        false
    end
  end

  defp recent_buckets(count) do
    now = Date.utc_today()
    month = now.month
    year = now.year

    Enum.map(0..(count - 1), fn offset ->
      total = year * 12 + (month - 1) - offset
      y = div(total, 12)
      m = rem(total, 12) + 1
      y * 100 + m
    end)
  end

  defp bucket(%DateTime{year: year, month: month}), do: year * 100 + month

  defp room_members(room_id) do
    case Repo.execute(
           "SELECT user_id FROM room_members WHERE room_id = ?",
           [{"text", room_id}]
         ) do
      {:ok, rows} ->
        members = rows |> Enum.map(& &1["user_id"]) |> Enum.filter(&is_binary/1)
        {:ok, members}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp peer_member(members, caller_id_bin) do
    case Enum.find(members, fn id -> id != caller_id_bin end) do
      nil -> {:error, :peer_not_found}
      peer_id -> {:ok, peer_id}
    end
  end

  defp timestamp_sort_key(%{started_at: started_at}) do
    case DateTime.from_iso8601(started_at || "") do
      {:ok, value, _} -> DateTime.to_unix(value, :microsecond)
      _ -> 0
    end
  end

  defp iso(nil), do: nil
  defp iso(%DateTime{} = value), do: DateTime.to_iso8601(value)

  defp iso(%NaiveDateTime{} = value),
    do: value |> DateTime.from_naive!("Etc/UTC") |> DateTime.to_iso8601()

  defp iso(value) when is_binary(value), do: value
  defp iso(_), do: nil

  defp uuid_to_string(nil), do: nil

  defp uuid_to_string(value) when is_binary(value) do
    case Ecto.UUID.cast(value) do
      {:ok, string} -> string
      _ -> Base.encode64(value)
    end
  end

  defp uuid_to_string(value), do: to_string(value)

  defp normalize_call_type("video"), do: "video"
  defp normalize_call_type(_), do: "voice"

  defp normalize_status(status) when is_binary(status) and status != "", do: status
  defp normalize_status(_), do: "failed"

  defp to_int(value) when is_integer(value), do: value
  defp to_int(_), do: 0
end
