import Config

config :chat_service, ChatServiceWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4000],
  check_origin: [
    "//localhost",
    "//localhost:3000",
    "//localhost:3001",
    "//localhost:3002",
    "//127.0.0.1",
    "//127.0.0.1:3000",
    "//127.0.0.1:3001",
    "//127.0.0.1:3002",
    "//lajukan.com",
    "//www.lajukan.com",
    "//chat.lajukan.com"
  ],
  code_reloader: true,
  debug_errors: true,
  secret_key_base: "dev_secret_key_base_minimal_64_chars_long_for_dev_only_12345",
  render_errors: [view: ChatServiceWeb.ErrorJSON, accepts: ~w(json)]

# Log level detail untuk debugging
config :logger, :console, format: "[$level] $message\n", level: :debug

# Stacktrace lebih panjang di dev
config :phoenix, :stacktrace_depth, 20
