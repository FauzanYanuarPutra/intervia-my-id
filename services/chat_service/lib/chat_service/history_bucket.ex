defmodule ChatService.HistoryBucket do
  @moduledoc """
  Resolves the newest persisted message bucket for a room.

  Message partitions are monthly. Falling back blindly to the current month
  makes an inactive conversation appear empty, so the canonical inbox
  projection is used as the source of the latest timestamp. The legacy lookup
  is intentionally bounded and only exists during the user_room_state rollout.
  """

  alias ChatService.Repo

  @legacy_lookup_limit 500

  @spec latest(binary(), binary()) :: integer()
  def latest(user_id_bin, room_id) when is_binary(user_id_bin) and is_binary(room_id) do
    canonical_timestamp(user_id_bin, room_id)
    |> case do
      nil -> legacy_timestamp(user_id_bin, room_id)
      timestamp -> timestamp
    end
    |> bucket_or_current()
  end

  def latest(_user_id_bin, _room_id), do: Repo.get_bucket(DateTime.utc_now())

  defp canonical_timestamp(user_id_bin, room_id) do
    case Repo.execute(
           "SELECT last_message_at FROM user_room_state WHERE user_id = ? AND room_id = ? LIMIT 1",
           [{"uuid", user_id_bin}, {"text", room_id}]
         ) do
      {:ok, rows} ->
        rows
        |> Enum.take(1)
        |> case do
          [row] -> row["last_message_at"]
          _ -> nil
        end

      _ ->
        nil
    end
  end

  defp legacy_timestamp(user_id_bin, room_id) do
    case Repo.execute(
           "SELECT room_id, last_message_at FROM user_rooms WHERE user_id = ? ORDER BY last_message_at DESC LIMIT ?",
           [{"uuid", user_id_bin}, {"int", @legacy_lookup_limit}]
         ) do
      {:ok, rows} ->
        rows
        |> Enum.find(fn row -> row["room_id"] == room_id end)
        |> case do
          nil -> nil
          row -> row["last_message_at"]
        end

      _ ->
        nil
    end
  end

  defp bucket_or_current(%DateTime{year: year, month: month}), do: year * 100 + month
  defp bucket_or_current(%NaiveDateTime{year: year, month: month}), do: year * 100 + month
  defp bucket_or_current(_), do: Repo.get_bucket(DateTime.utc_now())
end
