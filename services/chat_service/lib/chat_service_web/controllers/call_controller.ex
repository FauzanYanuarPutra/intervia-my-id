defmodule ChatServiceWeb.CallController do
  use ChatServiceWeb, :controller

  alias ChatService.CallHistory

  def show(conn, %{"call_id" => call_id_raw}) do
    user_id_bin = conn.assigns.current_user_id_bin

    case parse_call_id(call_id_raw) do
      {:ok, call_id} ->
        case CallHistory.get_for_user(call_id, user_id_bin) do
          {:ok, data} ->
            json(conn, %{data: data})

          {:error, :forbidden} ->
            conn |> put_status(:not_found) |> json(%{error: "call not found"})

          {:error, :not_found} ->
            conn |> put_status(:not_found) |> json(%{error: "call not found"})

          {:error, _reason} ->
            conn
            |> put_status(:service_unavailable)
            |> json(%{error: "call history unavailable"})
        end

      :error ->
        conn |> put_status(:bad_request) |> json(%{error: "invalid call id"})
    end
  end

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

  defp parse_call_id(value) when is_binary(value) do
    case Ecto.UUID.cast(String.trim(value)) do
      {:ok, canonical} -> {:ok, canonical}
      :error -> :error
    end
  end

  defp parse_call_id(_), do: :error

  defp to_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, _} -> parsed
      _ -> default
    end
  end

  defp to_int(value, _default) when is_integer(value), do: value
  defp to_int(_, default), do: default
end