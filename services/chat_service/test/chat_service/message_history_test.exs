defmodule ChatService.MessageHistoryTest do
  use ExUnit.Case, async: true

  alias ChatService.{MessageHistory, MessageId}

  @room_id "group:privacy-regression"
  @bucket 202_608
  @limit 50
  @joined_at ~U[2026-08-13 10:15:00.000Z]

  test "group history is always bounded by the member joined_at timestamp" do
    assert {:ok, {latest_query, latest_args}} =
             MessageHistory.build_query(
               @room_id,
               @bucket,
               nil,
               @limit,
               "group",
               @joined_at
             )

    assert latest_query =~ "message_id >= minTimeuuid(?)"
    assert {"timestamp", @joined_at} in latest_args

    before_id = MessageId.generate(~U[2026-08-13 11:00:00.000Z])
    assert {:ok, before_id_bin} = MessageId.dump(before_id)

    assert {:ok, {paginated_query, paginated_args}} =
             MessageHistory.build_query(
               @room_id,
               @bucket,
               before_id_bin,
               @limit,
               "group",
               @joined_at
             )

    assert paginated_query =~ "message_id < ?"
    assert paginated_query =~ "message_id >= minTimeuuid(?)"
    assert {"timeuuid", before_id_bin} in paginated_args
    assert {"timestamp", @joined_at} in paginated_args
  end

  test "group history fails closed when joined_at is unavailable" do
    assert {:error, :missing_joined_at} =
             MessageHistory.build_query(@room_id, @bucket, nil, @limit, "group", nil)
  end

  test "direct and support history retain their existing unbounded semantics" do
    for room_type <- ["dm", "support"] do
      assert {:ok, {query, args}} =
               MessageHistory.build_query(
                 "#{room_type}:existing-room",
                 @bucket,
                 nil,
                 @limit,
                 room_type,
                 @joined_at
               )

      refute query =~ "minTimeuuid"
      refute Enum.any?(args, fn {type, _value} -> type == "timestamp" end)
    end
  end
end
