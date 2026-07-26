defmodule ChatServiceWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :chat_service

  @production_origins [
    "https://lajukan.com",
    "https://www.lajukan.com",
    "https://chat.lajukan.com",
    "https://usaha.lajukan.com"
  ]
  @development_origins [
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:3002",
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002"
  ]

  @production_socket_origins [
    "//lajukan.com",
    "//www.lajukan.com",
    "//chat.lajukan.com",
    "//usaha.lajukan.com"
  ]
  @development_socket_origins [
    "//127.0.0.1",
    "//127.0.0.1:3000",
    "//127.0.0.1:3001",
    "//127.0.0.1:3002",
    "//localhost",
    "//localhost:3000",
    "//localhost:3001",
    "//localhost:3002"
  ]
  @allowed_origins if Mix.env() == :prod,
                     do: @production_origins,
                     else: @production_origins ++ @development_origins
  @socket_allowed_origins if Mix.env() == :prod,
                          do: @production_socket_origins,
                          else: @production_socket_origins ++ @development_socket_origins

  socket "/socket", ChatServiceWeb.UserSocket,
    websocket: [
      check_origin: @socket_allowed_origins,
      connect_info: [:peer_data, :x_headers],
      serializer: [
        {Phoenix.Socket.V1.JSONSerializer, "~> 1.0.0"},
        {Phoenix.Socket.V2.JSONSerializer, "~> 2.0.0"}
      ]
    ],
    longpoll: [
      check_origin: @socket_allowed_origins
    ]

  plug ChatServiceWeb.Plugs.SecurityHeaders
  plug :health_check

  defp health_check(%{path_info: ["api", "health"]} = conn, _opts) do
    conn |> put_resp_content_type("application/json") |> send_resp(200, ~s({"status":"ok"})) |> halt()
  end
  defp health_check(conn, _opts), do: conn

  plug Plug.RequestId
  plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]

  plug CORSPlug, origin: @allowed_origins

  plug Plug.Parsers,
    parsers: [:urlencoded, :multipart, :json],
    pass: ["*/*"],
    length: 2_000_000,
    json_decoder: Phoenix.json_library()

  plug ChatServiceWeb.Router
end
