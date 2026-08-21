defmodule ChatService.TrustSafetyTest do
  use ExUnit.Case, async: true

  alias ChatService.{MessageId, TrustSafety}

  describe "normalize_report/1" do
    test "accepts a supported reason and strips markup from bounded details" do
      message_id = MessageId.generate()

      assert {:ok,
              %{
                reason: "scam",
                details: "Meminta OTP",
                message_id: ^message_id
              }} =
               TrustSafety.normalize_report(%{
                 "reason" => " SCAM ",
                 "details" => "<b>Meminta OTP</b>",
                 "message_id" => message_id
               })
    end

    test "allows a room report without a message id" do
      assert {:ok, %{reason: "spam", details: "", message_id: nil}} =
               TrustSafety.normalize_report(%{"reason" => "spam"})
    end

    test "rejects unknown reasons, non-timeuuid message ids, and oversized details" do
      assert {:error, :invalid_reason} =
               TrustSafety.normalize_report(%{"reason" => "not-a-reason"})

      assert {:error, :invalid_message_id} =
               TrustSafety.normalize_report(%{
                 "reason" => "spam",
                 "message_id" => Ecto.UUID.generate()
               })

      assert {:error, :invalid_details} =
               TrustSafety.normalize_report(%{
                 "reason" => "spam",
                 "details" => String.duplicate("a", 4_001)
               })
    end
  end

  describe "normalize_room_id/1" do
    test "accepts canonical room ids and rejects control characters or oversized ids" do
      assert {:ok, "dm:a:b"} = TrustSafety.normalize_room_id(" dm:a:b ")
      assert {:error, :invalid_room_id} = TrustSafety.normalize_room_id("dm:\na:b")

      assert {:error, :invalid_room_id} =
               TrustSafety.normalize_room_id(String.duplicate("a", 257))
    end
  end
end
