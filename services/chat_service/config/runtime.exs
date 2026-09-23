import Config

if config_env() == :prod do
  # 1. Web Endpoint Config
  secret_key_base = System.get_env("SECRET_KEY_BASE") || raise "missing SECRET_KEY_BASE"
  host = System.get_env("PHX_HOST") || "auth.lajukan.com"
  port = String.to_integer(System.get_env("APP_PORT") || "4000")
  scylla_host = System.get_env("SCYLLA_HOST") || "scylla_db"
  scylla_port = System.get_env("SCYLLA_PORT") || "9042"

  scylla_nodes =
    (System.get_env("SCYLLA_NODES") || "#{scylla_host}:#{scylla_port}")
    |> String.split(",")
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))

  if scylla_nodes == [] do
    raise "SCYLLA_NODES must contain at least one host:port"
  end

  jwt_algorithm =
    (System.get_env("JWT_ACCESS_ALG") || "RS256")
    |> String.trim()
    |> String.upcase()

  {jwt_guardian_key, jwt_allowed_algos, jwt_public_key_pem, jwt_legacy_secret, jwt_allow_legacy_hs256} =
    case jwt_algorithm do
      "RS256" ->
        public_key_pem =
          System.fetch_env!("JWT_PUBLIC_KEY_PEM")
          |> String.replace("\\n", "\n")

        {JOSE.JWK.from_pem(public_key_pem), ["RS256"], public_key_pem, nil, false}

      "HS256" ->
        if System.get_env("ENV") == "development" do
          jwt_secret =
            System.get_env("JWT_SECRET") ||
              raise "missing JWT_SECRET for development HS256"

          if byte_size(jwt_secret) < 32 do
            raise "JWT_SECRET must be at least 32 characters for development HS256"
          end

          {JOSE.JWK.from_oct(jwt_secret), ["HS256"], nil, jwt_secret, true}
        else
          raise "HS256 access tokens are disabled in production; configure RS256"
        end

      other ->
        raise "unsupported JWT_ACCESS_ALG: #{other}"
    end

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

  config :chat_service, ChatService.Repo,
    nodes: scylla_nodes,
    keyspace: System.get_env("SCYLLA_KEYSPACE") || "laju_chat",
    connect_timeout: 10_000,
    max_concurrent_requests_per_connection: 128

  config :chat_service,
    jwt_issuer: jwt_issuer,
    jwt_audiences: jwt_audiences,
    jwt_legacy_secret: jwt_secret,
    jwt_public_key_pem: jwt_public_key_pem,
    jwt_allow_legacy_hs256: jwt_allow_legacy_hs256,
    identity_service_url:
      System.get_env("INTERNAL_API_URL") ||
        System.get_env("IDENTITY_SERVICE_URL") ||
        "http://identity_service:8080"

  # 3. Redis Config (Rate Limiter)
  config :hammer,
    backend:
      {Hammer.Backend.Redis,
       [
         # TAMBAHKAN INI
         expiry_ms: String.to_integer(System.get_env("RATE_LIMIT_EXPIRY_MS") || "60000"),
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
    secret_key: jwt_guardian_key,
    allowed_algos: jwt_allowed_algos
end
