defmodule ChatServiceWeb.HealthController do
  use ChatServiceWeb, :controller

  def index(conn, _params) do
    case ChatService.Repo.execute("SELECT now() FROM system.local") do
      {:ok, _} ->
        json(conn, %{status: "ready", timestamp: DateTime.utc_now()})

      _ ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{status: "not_ready", dependency: "scylladb", timestamp: DateTime.utc_now()})
    end
  end
end
