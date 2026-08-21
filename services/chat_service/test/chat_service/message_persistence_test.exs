defmodule ChatService.MessagePersistenceTest do
  use ExUnit.Case, async: true

  alias ChatService.MessagePersistence

  describe "normalize_client_ref/1" do
    test "accepts the refs emitted by current web clients" do
      assert {:ok, "temp-1720000000000-k3d91c"} =
               MessagePersistence.normalize_client_ref(" temp-1720000000000-k3d91c ")

      assert {:ok, "0190a.b:c_d-9"} =
               MessagePersistence.normalize_client_ref("0190a.b:c_d-9")
    end

    test "generates a safe ref for legacy callers" do
      assert {:ok, generated} = MessagePersistence.normalize_client_ref(nil)
      assert {:ok, _uuid} = Ecto.UUID.cast(generated)
    end

    test "rejects unbounded, non-ascii, and non-string refs" do
      assert {:error, :invalid_client_ref} = MessagePersistence.normalize_client_ref("")
      assert {:error, :invalid_client_ref} = MessagePersistence.normalize_client_ref("has space")
      assert {:error, :invalid_client_ref} = MessagePersistence.normalize_client_ref("pesan-🔒")

      assert {:error, :invalid_client_ref} =
               MessagePersistence.normalize_client_ref(String.duplicate("a", 129))

      assert {:error, :invalid_client_ref} = MessagePersistence.normalize_client_ref(123)
    end
  end

  describe "reservation_result/1" do
    test "distinguishes a new reservation from a retry" do
      assert :applied = MessagePersistence.reservation_result([%{"[applied]" => true}])

      existing = %{"[applied]" => false, "message_id" => <<1::128>>}
      assert {:existing, ^existing} = MessagePersistence.reservation_result([existing])

      assert :applied = MessagePersistence.reservation_result([%{:"[applied]" => true}])
    end

    test "fails closed for ambiguous LWT responses" do
      assert :unknown = MessagePersistence.reservation_result([])
      assert :unknown = MessagePersistence.reservation_result([%{}])
      assert :unknown = MessagePersistence.reservation_result([%{"[applied]" => nil}])
      assert :unknown = MessagePersistence.reservation_result(:not_enumerable)
    end
  end
end
