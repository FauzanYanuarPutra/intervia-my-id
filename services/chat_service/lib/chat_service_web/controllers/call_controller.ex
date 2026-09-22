defmodule ChatServiceWeb.CallController do
  use ChatServiceWeb, :controller

  alias ChatService.CallHistory

  def index(conn, params) do
    user_id_bin = conn.assigns.current_user_id_bin

    limit =
      params
      |> Map.get("limit", "100")
      |> to_int(100)
      |> min(200)
      |> max(1)

    case CallHistory.list_for_user(user_id_bin, limit) do
      {:ok, data} ->
        json(conn, %{data: data})

      {:error, _reason} ->
        conn
        |> put_status(:service_unavailable)
        |> json(%{error: "call history unavailable"})
    end
  end

  defp to_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, _} -> parsed
      _ -> default
    end
  end

  defp to_int(value, _default) when is_integer(value), do: value
  defp to_int(_, default), do: default
end