defmodule ChatService.CallSignalingTest do
  use ExUnit.Case, async: true

  alias ChatService.CallSignaling

  test "relayed call ids are canonical UUIDs and invalid start ids are replaced" do
    id = Ecto.UUID.generate()
    assert {:ok, ^id} = CallSignaling.call_id(id)
    assert {:error, :invalid_call_id} = CallSignaling.call_id("call-arbitrary")

    assert {:ok, generated} = CallSignaling.start_call_id("call-arbitrary")
    assert {:ok, ^generated} = Ecto.UUID.cast(generated)
  end

  test "signaling payloads must be bounded JSON objects" do
    assert {:ok, ~s({"type":"offer","sdp":"abc"})} =
             CallSignaling.json_object(~s({"type":"offer","sdp":"abc"}), 64 * 1_024)

    assert {:error, :invalid_signal} = CallSignaling.json_object("not-json", 8 * 1_024)
    assert {:error, :invalid_signal} = CallSignaling.json_object(~s(["array"]), 8 * 1_024)

    assert {:error, :invalid_signal} =
             CallSignaling.json_object(Jason.encode!(%{value: String.duplicate("a", 100)}), 32)
  end
end
