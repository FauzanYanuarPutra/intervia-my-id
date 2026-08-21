defmodule ChatService.MessageIdTest do
  use ExUnit.Case, async: true

  alias ChatService.MessageId

  test "generates a Cassandra timeuuid that round-trips as one stable ID" do
    sent_at = ~U[2026-08-10 12:34:56.123456Z]
    message_id = MessageId.generate(sent_at)

    assert <<_::binary-size(14), "1", _::binary>> = message_id
    assert {:ok, binary} = MessageId.dump(message_id)
    assert {:ok, ^message_id} = MessageId.to_string(binary)
    assert {:ok, 202_608} = MessageId.bucket(message_id)
  end

  test "rejects UUID versions that Scylla cannot use as a timeuuid cursor" do
    refute match?({:ok, _binary}, MessageId.dump(Ecto.UUID.generate()))
  end
end
