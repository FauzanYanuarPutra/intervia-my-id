defmodule ChatService.RoomAccessTest do
  use ExUnit.Case, async: true

  alias ChatService.RoomAccess

  test "only owner and admin roles can manage group membership" do
    assert RoomAccess.manager_role?("owner")
    assert RoomAccess.manager_role?(" ADMIN ")

    refute RoomAccess.manager_role?("member")
    refute RoomAccess.manager_role?("support")
    refute RoomAccess.manager_role?(nil)
  end
end
