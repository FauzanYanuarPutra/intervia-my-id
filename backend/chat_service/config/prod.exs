import Config

# Di produksi, kita membatasi log agar tidak memenuhi disk
config :chat_service, ChatServiceWeb.Endpoint,
  render_errors: [view: ChatServiceWeb.ErrorJSON, accepts: ~w(json)]

config :logger, level: :info

# Filter parameter sensitif dari log (Password, JWT, dsb)
config :phoenix, :filter_parameters, ["password", "token", "secret", "jwt"]
