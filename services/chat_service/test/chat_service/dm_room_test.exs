defmodule ChatService.DmRoomTest do
  use ExUnit.Case, async: true

  describe "build_room_id/2" do
    test "same order gives same id as reversed order" do
      a = Ecto.UUID.bingenerate()
      b = Ecto.UUID.bingenerate()
      id1 = ChatService.DmRoom.build_room_id(a, b)
      id2 = ChatService.DmRoom.build_room_id(b, a)
      assert id1 == id2
      assert String.starts_with?(id1, "dm:")
    end

    test "format is dm:min_uuid:max_uuid" do
      # Use known UUIDs: smaller string first
      small = "00000000-0000-0000-0000-000000000001" |> Ecto.UUID.dump!()
      large = "00000000-0000-0000-0000-000000000002" |> Ecto.UUID.dump!()
      id = ChatService.DmRoom.build_room_id(small, large)
      assert id == "dm:00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000002"
    end
  end

  describe "validate_not_self/2" do
    test "different users return :ok" do
      a = Ecto.UUID.bingenerate()
      b = Ecto.UUID.bingenerate()
      assert ChatService.DmRoom.validate_not_self(a, b) == :ok
    end

    test "same user returns {:error, :self_chat}" do
      a = Ecto.UUID.bingenerate()
      assert ChatService.DmRoom.validate_not_self(a, a) == {:error, :self_chat}
    end
  end

  describe "peer_user_id_bin/2" do
    test "returns the other participant and rejects an outsider" do
      first = "00000000-0000-0000-0000-000000000001" |> Ecto.UUID.dump!()
      second = "00000000-0000-0000-0000-000000000002" |> Ecto.UUID.dump!()
      outsider = "00000000-0000-0000-0000-000000000003" |> Ecto.UUID.dump!()
      room_id = ChatService.DmRoom.build_room_id(first, second)

      assert ChatService.DmRoom.peer_user_id_bin(room_id, first) == second
      assert ChatService.DmRoom.peer_user_id_bin(room_id, second) == first
      assert ChatService.DmRoom.peer_user_id_bin(room_id, outsider) == nil
    end
  end
end
