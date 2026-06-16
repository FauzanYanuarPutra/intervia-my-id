defmodule ChatService.Application do
  @moduledoc """
  Final application entry point with ETS initialization and Xandra config sanitization.
  """
  use Application

  @impl true
  def start(_type, _args) do
    # 1. INISIALISASI ETS (PENTING)
    # Membuat tabel :rate_limiter agar bisa diakses oleh semua proses Channel.
    # :public memungkinkan proses channel mengupdate counter.
    # :named_table memungkinkan kita memanggilnya dengan atom :rate_limiter.
    if :ets.whereis(:rate_limiter) == :undefined do
      :ets.new(:rate_limiter, [
        :set,
        :public,
        :named_table,
        read_concurrency: true,
        write_concurrency: true
      ])
    end

    :ok = ChatService.PresenceCache.init()

    # 2. Ambil konfigurasi dari Application Environment
    raw_repo_opts = Application.get_env(:chat_service, ChatService.Repo, [])
    hammer_config = Application.get_env(:hammer, :backend)

    # 3. SANITASI KONFIGURASI XANDRA
    repo_opts =
      raw_repo_opts
      |> Keyword.drop([:target_concurrency, :address_resolution, :port])
      |> Keyword.put_new(:nodes, ["scylla_db:9042"])

    children = [
      # --- INFRASTRUCTURE (Layer 1) ---
      # Menjalankan Repo dengan opsi yang sudah dibersihkan
      {ChatService.Repo, repo_opts},

      # Menjalankan Hammer Backend (Redis)
      {Hammer.Backend.Redis, hammer_config |> elem(1)},

      # --- ASYNC WORKERS ---
      # Supervisor untuk tugas-tugas background
      {Task.Supervisor, name: ChatService.TaskSupervisor},

      # --- COMMUNICATION (Layer 2) ---
      {Phoenix.PubSub, name: ChatService.PubSub},
      ChatServiceWeb.Presence,

      # --- INTERFACE (Layer 3) ---
      ChatServiceWeb.Endpoint
    ]

    # Strategi :one_for_one artinya jika satu child mati, hanya child itu yang direstart
    opts = [strategy: :one_for_one, name: ChatService.Supervisor]

    case Supervisor.start_link(children, opts) do
      {:ok, pid} ->
        {:ok, pid}

      {:error, reason} ->
        # Log jika terjadi kegagalan startup untuk memudahkan debugging di Docker
        IO.inspect(reason, label: "Application startup failed")
        {:error, reason}
    end
  end

  @impl true
  def config_change(changed, _new, removed) do
    ChatServiceWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
