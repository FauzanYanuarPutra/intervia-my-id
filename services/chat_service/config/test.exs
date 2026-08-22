import Config

config :chat_service, ChatServiceWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "test_secret_key_base_minimal_64_chars_long_for_testing_purposes",
  server: false

# Pakai Logger level warning agar output test bersih
config :logger, level: :warning

# Pakai ETS (In-memory) untuk rate limiter saat test
config :hammer,
  backend: {Hammer.Backend.ETS, [expiry_ms: 60_000, cleanup_interval_ms: 60_000]}
