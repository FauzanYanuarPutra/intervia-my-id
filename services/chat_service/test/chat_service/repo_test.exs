defmodule ChatService.RepoTest do
  use ExUnit.Case, async: true

  describe "get_bucket/1" do
    test "returns year*100 + month for a given datetime" do
      # 2025-02-09 -> 202502
      dt = ~U[2025-02-09 12:00:00Z]
      assert ChatService.Repo.get_bucket(dt) == 202_502
    end

    test "uses utc_now when no arg" do
      # Just ensure it returns an integer in reasonable range (e.g. 202xxx)
      bucket = ChatService.Repo.get_bucket()
      assert is_integer(bucket)
      assert bucket >= 202_001
      assert bucket <= 210_012
    end
  end
end
