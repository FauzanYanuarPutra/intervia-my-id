defmodule ChatServiceWeb.Plugs.SecurityHeaders do
  @moduledoc false

  import Plug.Conn

  @public_hosts ~w(lajukan.com www.lajukan.com chat.lajukan.com usaha.lajukan.com)
  @prod Mix.env() == :prod

  def init(opts), do: opts

  def call(conn, _opts) do
    conn
    |> maybe_redirect_https()
    |> put_security_headers()
  end

  defp maybe_redirect_https(conn) do
    if prod?() and forwarded_proto(conn) == "http" and conn.host in @public_hosts do
      location = "https://" <> conn.host <> conn.request_path <> query_string(conn)

      conn
      |> put_security_headers()
      |> put_resp_header("location", location)
      |> send_resp(308, "")
      |> halt()
    else
      conn
    end
  end

  defp put_security_headers(%Plug.Conn{halted: true} = conn), do: conn

  defp put_security_headers(conn) do
    conn
    |> put_resp_header("content-security-policy", "default-src 'none'; frame-ancestors 'none'")
    |> put_resp_header("referrer-policy", "strict-origin-when-cross-origin")
    |> put_resp_header("x-content-type-options", "nosniff")
    |> put_resp_header("x-frame-options", "DENY")
    |> put_resp_header("permissions-policy", "camera=(), microphone=(), geolocation=()")
    |> maybe_put_hsts()
  end

  defp maybe_put_hsts(conn) do
    if prod?() do
      put_resp_header(
        conn,
        "strict-transport-security",
        "max-age=31536000; includeSubDomains; preload"
      )
    else
      conn
    end
  end

  defp forwarded_proto(conn) do
    conn
    |> get_req_header("x-forwarded-proto")
    |> List.first()
    |> case do
      nil -> nil
      proto -> proto |> String.split(",") |> List.first() |> String.trim() |> String.downcase()
    end
  end

  defp query_string(%Plug.Conn{query_string: ""}), do: ""
  defp query_string(%Plug.Conn{query_string: query}), do: "?" <> query

  defp prod?, do: @prod or Application.get_env(:chat_service, :env) == :prod
end
