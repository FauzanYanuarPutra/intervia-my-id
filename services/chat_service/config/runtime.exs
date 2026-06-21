import Config

if config_env() == :prod do
  # 1. Web Endpoint Config
  secret_key_base = System.get_env("SECRET_KEY_BASE") || raise "missing SECRET_KEY_BASE"
  host = System.get_env("PHX_HOST") || "auth.lajukan.com"
  port = String.to_integer(System.get_env("APP_PORT") || "4000")
  scylla_host = System.get_env("SCYLLA_HOST") || "scylla_db"
  scylla_port = System.get_env("SCYLLA_PORT") || "9042"
  jwt_secret = System.fetch_env!("JWT_SECRET") || "lajukan_super_secure_vault_key_2026_jakarta_v1_top_secret"
  jwt_issuer = System.get_env("JWT_ISSUER") || "laju"
  jwt_audiences =
    (System.get_env("CHAT_JWT_AUDIENCES") ||
       System.get_env("JWT_AUDIENCE") ||
       "chat_service,laju_users")
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))

  config :chat_service, ChatServiceWeb.Endpoint,
    server: true,
    url: [host: host, port: 443, scheme: "https"],
    http: [ip: {0, 0, 0, 0}, port: port],
    secret_key_base: secret_key_base

  config :chat_service, ChatService.Repo, [
    nodes: ["#{scylla_host}:#{scylla_port}"],
    keyspace: System.get_env("SCYLLA_KEYSPACE") || "laju_chat",
    connect_timeout: 10_000,
    max_concurrent_requests_per_connection: 128
  ]

  config :chat_service,
    jwt_issuer: jwt_issuer,
    jwt_audiences: jwt_audiences,
    identity_service_url:
      System.get_env("INTERNAL_API_URL") ||
        System.get_env("IDENTITY_SERVICE_URL") ||
        "http://identity_service:8080"

  # 3. Redis Config (Rate Limiter)
  config :hammer,
    backend: {Hammer.Backend.Redis, [
      expiry_ms: String.to_integer(System.get_env("RATE_LIMIT_EXPIRY_MS") || "60000"), # TAMBAHKAN INI
      redix_config: [
        host: System.get_env("REDIS_HOST") || "redis_cache",
        password: System.get_env("REDIS_PASSWORD"),
        port: String.to_integer(System.get_env("REDIS_PORT") || "6379")
      ]
    ]}

  # 4. RabbitMQ Config
  config :amqp,
    connections: [chat_conn: [url: System.get_env("RABBITMQ_URL")]]

  # 5. Guardian Config (JWT)
  config :chat_service, ChatService.Guardian,
    issuer: nil,
    secret_key: jwt_secret,
    allowed_algos: ["HS256"]


end
