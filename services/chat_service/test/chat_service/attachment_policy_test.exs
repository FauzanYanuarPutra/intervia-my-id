defmodule ChatService.AttachmentPolicyTest do
  use ExUnit.Case, async: true

  alias ChatService.AttachmentPolicy

  describe "normalize/2 media policy" do
    test "accepts only controlled chat and content media paths" do
      chat_url = "/api/chat/media/laju-chat/chat/dm_a_b/asset.webp"
      content_url = "/api/content/media/laju-chat/content/cover.jpg"

      assert {:ok, [^chat_url]} = AttachmentPolicy.normalize("image", [chat_url])
      assert {:ok, [^content_url]} = AttachmentPolicy.normalize("file", [content_url])

      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("image", ["https://tracker.example/pixel.png"])

      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("file", ["javascript:alert(1)"])

      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("image", [
                 "/api/chat/media/laju-chat/chat/dm_a_b/%2e%2e"
               ])
    end

    test "does not let user messages attach media to text or remote sticker URLs" do
      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("text", [
                 "/api/chat/media/laju-chat/chat/dm_a_b/asset.png"
               ])

      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("sticker", [
                 "https://raw.githubusercontent.com/example/sticker.png"
               ])

      assert {:ok, []} = AttachmentPolicy.normalize("sticker", [])
    end
  end

  describe "normalize/2 structured card policy" do
    test "keeps bounded commerce fields while dropping unsafe URL fields" do
      raw =
        Jason.encode!(%{
          "content_id" => "listing-123",
          "content_title" => "Kopi Arabika",
          "content_url" => "/id/content/kopi-arabika",
          "cover_image" => "https://tracker.example/cover.jpg",
          "applicant" => %{
            "full_name" => "Budi",
            "resume_url" => "javascript:alert(1)"
          },
          "price_cents" => 25_000_00
        })

      assert {:ok, [encoded]} = AttachmentPolicy.normalize("listing", [raw])
      assert {:ok, sanitized} = Jason.decode(encoded)
      assert sanitized["content_id"] == "listing-123"
      assert sanitized["content_url"] == "/id/content/kopi-arabika"
      refute Map.has_key?(sanitized, "cover_image")
      refute Map.has_key?(sanitized["applicant"], "resume_url")
    end

    test "rejects arrays, prototype keys, unbounded values, and multiple cards" do
      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("listing", [~s([{"content_id":"one"}])])

      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("listing", [~s({"__proto__":{"admin":true}})])

      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("listing", [
                 Jason.encode!(%{"summary" => String.duplicate("x", 4_097)})
               ])

      card = Jason.encode!(%{"content_id" => "one"})

      assert {:error, :invalid_attachments} =
               AttachmentPolicy.normalize("listing", [card, card])
    end
  end
end
