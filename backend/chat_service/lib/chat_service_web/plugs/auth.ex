defmodule ChatServiceWeb.Plugs.Auth do
  @moduledoc false

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  alias ChatService.Auth

  def init(opts), do: opts

  def call(conn, _opts) do
    with ["Bearer " <> token] <- get_req_header(conn, "authorization"),
         {:ok, claims} <- Auth.verify_jwt(token),
         {:ok, user_id_bin} <- Ecto.UUID.dump(claims["sub"]) do
      conn
      |> assign(:current_user_id, claims["sub"])
      |> assign(:current_user_id_bin, user_id_bin)
      |> assign(:current_user_roles, claims["roles"] || [])
      |> assign(:current_user_perms, claims["perms"] || [])
    else
      _ ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "unauthorized"})
        |> halt()
    end
  end
end
