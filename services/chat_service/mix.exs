defmodule ChatService.MixProject do
  use Mix.Project

  def project do
    [
      app: :chat_service,
      version: "0.1.0",
      elixir: "~> 1.17",
      start_permanent: Mix.env() == :prod,
      build_embedded: Mix.env() == :prod,
      deps: deps(),
      elixirc_paths: elixirc_paths(Mix.env()),
      releases: [
        chat_service: [
          validate_compile_env: false
        ]
      ]
    ]
  end

  defp elixirc_paths(:test), do: ["lib", "test/support"]
  defp elixirc_paths(_), do: ["lib"]

  def application do
    [
      mod: {ChatService.Application, []},
      extra_applications: [
        :logger,
        :runtime_tools,
        :crypto,
        :os_mon,
        :inets,
        :amqp,
        :hammer,
        :redix,
        :xandra,
        :html_entities,
        :html_sanitize_ex
      ]
    ]
  end

  defp deps do
    [
      {:amqp, "~> 4.1"},
      {:phoenix, "~> 1.8.3"},
      {:phoenix_pubsub, "~> 2.2"},
      {:plug_cowboy, "~> 2.7"},
      {:gettext, "~> 0.22"},
      {:plug, "~> 1.20.3"},
      {:cors_plug, "~> 3.0"},
      {:jason, "~> 1.4"},
      {:guardian, "~> 2.4"},
      {:jose, "~> 1.11"},
      {:hammer, "~> 6.0"},
      {:hammer_plug, "~> 3.2"},
      {:hammer_backend_redis, "~> 6.0"},
      {:xandra, "~> 0.19"},
      {:redix, "~> 1.5"},
      {:decimal, "~> 3.1"},
      {:telemetry, "~> 1.3"},
      {:telemetry_metrics, "~> 1.1"},
      {:telemetry_poller, "~> 1.0"},
      {:elixir_uuid, "~> 1.2"},
      {:phoenix_pubsub_redis, "~> 3.0"},
      {:html_entities, "~> 0.5"},
      {:html_sanitize_ex, "~> 1.4"},
      {:ecto, "~> 3.10"},
      {:ecto_sql, "~> 3.10"}
    ]
  end
end
