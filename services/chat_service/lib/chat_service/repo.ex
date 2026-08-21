defmodule ChatService.Repo do
  @moduledoc "Core ScyllaDB Engine Optimized."
  require Logger

  def child_spec(opts) do
    default_opts = [
      name: __MODULE__,
      nodes: Application.get_env(:chat_service, :scylla_nodes, ["127.0.0.1"]),
      backoff_type: :exp,
      max_concurrent_requests_per_connection: 32
    ]

    Xandra.Cluster.child_spec(Keyword.merge(default_opts, opts))
  end

  def execute(query, params \\ [], opts \\ []) do
    start_time = System.monotonic_time()
    # Eksekusi standar tanpa manual retry_strategy module
    result = Xandra.Cluster.execute(__MODULE__, query, params, opts)
    log_performance(query, start_time)
    result
  end

  def get_bucket(datetime \\ DateTime.utc_now()) do
    datetime.year * 100 + datetime.month
  end

  defp log_performance(query, start_time) do
    latency =
      System.convert_time_unit(System.monotonic_time() - start_time, :native, :millisecond)

    if latency > 100,
      do: Logger.warning("Slow Query (#{latency}ms): #{String.slice(query, 0, 50)}")
  end
end
