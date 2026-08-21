import Config

config :chat_service,
  env: Mix.env(),
  namespace: ChatService,
  identity_service_url:
    System.get_env("INTERNAL_API_URL") ||
      System.get_env("IDENTITY_SERVICE_URL") ||
      "http://localhost:8080"

config :chat_service, ChatServiceWeb.Endpoint,
  url: [host: "localhost"],
  adapter: Phoenix.Endpoint.Cowboy2Adapter,
  render_errors: [formats: [json: ChatServiceWeb.ErrorJSON], accepts: ~w(json)],
  pubsub_server: ChatService.PubSub

# --- KONFIGURASI PUBSUB REDIS ---
# Digunakan untuk sinkronisasi pesan antar node Elixir
config :chat_service, ChatService.PubSub,
  adapter: Phoenix.PubSub.Redis,
  # Menggunakan host "redis" (asumsi nama service di docker-compose adalah redis)
  host: System.get_env("REDIS_HOST") || "redis",
  port: String.to_integer(System.get_env("REDIS_PORT") || "6379"),
  node_name: System.get_env("NODE_NAME") || "chat_service_node"

# --- KONFIGURASI SCYLLADB ---
config :chat_service, ChatService.Repo, nodes: [System.get_env("SCYLLA_HOST") || "scylla_db:9042"]

config :phoenix, :json_library, Jason

import_config "#{config_env()}.exs"
