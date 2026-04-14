defmodule ChatServiceWeb.HealthController do
  use ChatServiceWeb, :controller

  def index(conn, _params) do
    # Cek apakah ScyllaDB hidup
    status = case ChatService.Repo.execute("SELECT now() FROM system.local") do
      {:ok, _} -> "up"
      _ -> "database_error"
    end

    json(conn, %{status: status, timestamp: DateTime.utc_now()})
  end
end
