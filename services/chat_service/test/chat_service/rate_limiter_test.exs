defmodule ChatService.RateLimiterTest do
  use ExUnit.Case, async: true

  alias ChatService.RateLimiter

  test "limits only inside the configured time window" do
    key = {:test_rate_limit, make_ref()}
    on_exit(fn -> RateLimiter.reset(key) end)

    assert :ok = RateLimiter.check(key, 2, 1_000, 10_000)
    assert :ok = RateLimiter.check(key, 2, 1_000, 10_100)
    assert {:error, :rate_limited} = RateLimiter.check(key, 2, 1_000, 10_999)

    assert :ok = RateLimiter.check(key, 2, 1_000, 11_000)
    assert :ok = RateLimiter.check(key, 2, 1_000, 11_001)
    assert {:error, :rate_limited} = RateLimiter.check(key, 2, 1_000, 11_002)
  end
end
