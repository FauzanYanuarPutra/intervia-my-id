defmodule ChatService.UnreadState do
  @moduledoc """
  Keeps the counter and canonical inbox projections in sync when a room is read.

  The inbox projection update targets only `unread_count` and uses the read
  time as its cell timestamp. A later message projection can therefore mark
  the room unread again without the read receipt overwriting message metadata.
  """

  alias ChatService.Repo

  @type clear_error ::
          {:unread_counter, term()}
          | {:inbox_projection, term()}

  @spec clear(binary(), binary()) :: :ok | {:error, clear_error()}
  def clear(user_id_bin, room_id) do
    clear_with(user_id_bin, room_id, System.system_time(:microsecond), &Repo.execute/2)
  end

  @doc false
  @spec clear_with(binary(), binary(), integer(), function()) ::
          :ok | {:error, clear_error() | :invalid_unread_state}
  def clear_with(user_id_bin, room_id, write_timestamp, execute)
      when is_binary(user_id_bin) and is_binary(room_id) and is_integer(write_timestamp) and
             is_function(execute, 2) do
    with :ok <-
           execute_step(
             :unread_counter,
             execute,
             "DELETE FROM unread_counters WHERE user_id = ? AND room_id = ?",
             [{"uuid", user_id_bin}, {"text", room_id}]
           ),
         :ok <-
           execute_step(
             :inbox_projection,
             execute,
             """
             UPDATE user_room_state USING TIMESTAMP ?
             SET unread_count = ?
             WHERE user_id = ? AND room_id = ?
             """,
             [
               {"bigint", write_timestamp},
               {"int", 0},
               {"uuid", user_id_bin},
               {"text", room_id}
             ]
           ) do
      :ok
    end
  end

  def clear_with(_user_id_bin, _room_id, _write_timestamp, _execute),
    do: {:error, :invalid_unread_state}

  defp execute_step(stage, execute, query, params) do
    case execute.(query, params) do
      {:ok, _result} -> :ok
      {:error, reason} -> {:error, {stage, reason}}
      other -> {:error, {stage, {:unexpected_storage_result, other}}}
    end
  end
end
