defmodule ChatService.DmRoom do
  @moduledoc """
  Pure logic for DM room: deterministic room_id and validation.
  Extracted for unit testing and reuse.
  """
  @doc """
  Builds a deterministic DM room id from two user (binary) UUIDs.
  Order-independent: same pair always yields same room_id.
  """
  def build_room_id(user_id_bin_a, user_id_bin_b) when is_binary(user_id_bin_a) and is_binary(user_id_bin_b) do
    a_str = Ecto.UUID.cast!(user_id_bin_a)
    b_str = Ecto.UUID.cast!(user_id_bin_b)
    {min_id, max_id} = if a_str <= b_str, do: {a_str, b_str}, else: {b_str, a_str}
    "dm:#{min_id}:#{max_id}"
  end

  @doc """
  Returns :ok if the two user ids are different; {:error, :self_chat} if same.
  """
  def validate_not_self(user_id_bin_a, user_id_bin_b) do
    if user_id_bin_a == user_id_bin_b, do: {:error, :self_chat}, else: :ok
  end

  @doc """
  For a DM room_id "dm:min_uuid:max_uuid", returns the peer user id (binary)
  for the given current_user_id_bin. Returns nil if not a DM or current user not in room.
  """
  def peer_user_id_bin("dm:" <> rest, current_user_id_bin) when is_binary(current_user_id_bin) do
    parts = String.split(rest, ":", parts: 2)
    if length(parts) == 2 do
      [min_s, max_s] = parts
      with {:ok, min_b} <- Ecto.UUID.dump(min_s),
           {:ok, max_b} <- Ecto.UUID.dump(max_s) do
        cond do
          current_user_id_bin == min_b -> max_b
          current_user_id_bin == max_b -> min_b
          true -> nil
        end
      else
        _ -> nil
      end
    else
      nil
    end
  end
  def peer_user_id_bin(_, _), do: nil
end
