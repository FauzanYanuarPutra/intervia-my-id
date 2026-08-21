defmodule ChatService.RateLimiter do
  @moduledoc """
  Fixed-window limiter for realtime messages. Normal runtime checks use the
  configured Hammer/Redis backend so limits are shared by every chat replica;
  the ETS implementation is retained as a fail-safe and deterministic test
  boundary.
  """

  @table :rate_limiter

  @spec check(term(), pos_integer(), pos_integer()) :: :ok | {:error, :rate_limited}
  def check(key, limit, window_ms)
      when is_integer(limit) and limit > 0 and is_integer(window_ms) and window_ms > 0 do
    distributed_key =
      key
      |> :erlang.term_to_binary()
      |> then(&:crypto.hash(:sha256, &1))
      |> Base.url_encode64(padding: false)

    try do
      case Hammer.check_rate("chat:message:" <> distributed_key, window_ms, limit) do
        {:allow, _count} -> :ok
        {:deny, _limit} -> {:error, :rate_limited}
        _unexpected -> local_check(key, limit, window_ms, System.monotonic_time(:millisecond))
      end
    rescue
      _error -> local_check(key, limit, window_ms, System.monotonic_time(:millisecond))
    catch
      :exit, _reason -> local_check(key, limit, window_ms, System.monotonic_time(:millisecond))
    end
  end

  @spec check(term(), pos_integer(), pos_integer(), integer()) ::
          :ok | {:error, :rate_limited}
  def check(key, limit, window_ms, now_ms)
      when is_integer(limit) and limit > 0 and is_integer(window_ms) and window_ms > 0 and
             is_integer(now_ms) do
    local_check(key, limit, window_ms, now_ms)
  end

  defp local_check(key, limit, window_ms, now_ms) do
    ensure_table()
    do_check(key, limit, window_ms, now_ms)
  end

  @spec reset(term()) :: :ok
  def reset(key) do
    ensure_table()
    :ets.delete(@table, key)
    :ok
  end

  defp do_check(key, limit, window_ms, now_ms) do
    case :ets.lookup(@table, key) do
      [] ->
        if :ets.insert_new(@table, {key, 1, now_ms}) do
          :ok
        else
          do_check(key, limit, window_ms, now_ms)
        end

      [{^key, _count, started_at}] when now_ms - started_at >= window_ms ->
        match_spec = [
          {{:"$1", :_, :"$2"},
           [
             {:"=:=", :"$1", {:const, key}},
             {:"=:=", :"$2", started_at}
           ], [{{:"$1", 1, now_ms}}]}
        ]

        if :ets.select_replace(@table, match_spec) == 1 do
          :ok
        else
          do_check(key, limit, window_ms, now_ms)
        end

      [{^key, count, _started_at}] when count >= limit ->
        {:error, :rate_limited}

      [{^key, _count, _started_at}] ->
        if :ets.update_counter(@table, key, {2, 1}) <= limit do
          :ok
        else
          {:error, :rate_limited}
        end
    end
  end

  defp ensure_table do
    if :ets.whereis(@table) == :undefined do
      try do
        :ets.new(@table, [
          :set,
          :public,
          :named_table,
          read_concurrency: true,
          write_concurrency: true
        ])
      rescue
        ArgumentError -> @table
      end
    else
      @table
    end
  end
end
