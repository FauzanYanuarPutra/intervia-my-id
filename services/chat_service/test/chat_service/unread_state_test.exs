defmodule ChatService.UnreadStateTest do
  use ExUnit.Case, async: true

  alias ChatService.UnreadState

  @user_id <<1::128>>
  @room_id "dm:one:two"
  @write_timestamp 1_723_456_789_012_345

  test "clears the counter before resetting only the inbox unread cell" do
    test_process = self()

    execute = fn query, params ->
      send(test_process, {:execute, query, params})
      {:ok, :written}
    end

    assert :ok =
             UnreadState.clear_with(@user_id, @room_id, @write_timestamp, execute)

    assert_receive {:execute, counter_query, counter_params}
    assert counter_query == "DELETE FROM unread_counters WHERE user_id = ? AND room_id = ?"
    assert counter_params == [{"uuid", @user_id}, {"text", @room_id}]

    assert_receive {:execute, projection_query, projection_params}
    assert projection_query =~ "UPDATE user_room_state USING TIMESTAMP ?"
    assert projection_query =~ "SET unread_count = ?"
    refute projection_query =~ "last_message"
    refute projection_query =~ "last_message_at"

    assert projection_params == [
             {"bigint", @write_timestamp},
             {"int", 0},
             {"uuid", @user_id},
             {"text", @room_id}
           ]
  end

  test "stops without changing the inbox projection when the counter clear fails" do
    test_process = self()

    execute = fn query, _params ->
      send(test_process, {:execute, query})
      {:error, :scylla_unavailable}
    end

    assert {:error, {:unread_counter, :scylla_unavailable}} =
             UnreadState.clear_with(@user_id, @room_id, @write_timestamp, execute)

    assert_receive {:execute, "DELETE FROM unread_counters" <> _rest}
    refute_receive {:execute, "UPDATE user_room_state" <> _rest}
  end

  test "reports a projection failure after the counter was cleared" do
    test_process = self()

    execute = fn query, _params ->
      send(test_process, {:execute, query})

      if String.starts_with?(query, "DELETE") do
        {:ok, :written}
      else
        {:error, :write_timeout}
      end
    end

    assert {:error, {:inbox_projection, :write_timeout}} =
             UnreadState.clear_with(@user_id, @room_id, @write_timestamp, execute)

    assert_receive {:execute, "DELETE FROM unread_counters" <> _rest}
    assert_receive {:execute, projection_query}
    assert projection_query =~ "UPDATE user_room_state"
  end

  test "rejects invalid identifiers before executing storage calls" do
    execute = fn _query, _params -> flunk("storage must not be called") end

    assert {:error, :invalid_unread_state} =
             UnreadState.clear_with(nil, @room_id, @write_timestamp, execute)
  end
end
