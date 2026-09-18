defmodule ChatServiceWeb.UserSocket do
  use Phoenix.Socket

  alias ChatService.{Repo, PresenceCache, Auth, IdentityClient}
  require Logger

  # Channel definitions
  channel("room:*", ChatServiceWeb.RoomChannel)
  channel("user:*", ChatServiceWeb.UserChannel)
  channel("spatial:*", ChatServiceWeb.SpatialChannel)

  # Configuration Constants
  # 5 menit toleransi
  @audit_log_prefix "[Socket Auth]"

  # =========================================================
  # SOCKET CONNECT
  # =========================================================
  @impl true
  def connect(%{"token" => token}, socket, _connect_info) when is_binary(token) do
    # Pipeline koneksi dengan logging di setiap kegagalan
    with {:ok, claims} <- verify_and_validate_jwt(token),
         {:ok, user_ctx} <- build_enriched_context(claims) do
      # Pre-cast UUID string untuk FE agar tidak ada overhead di channel nantinya
      user_id_string = Ecto.UUID.cast!(user_ctx.user_id_bin)

      socket =
        socket
        |> assign(:user_id, user_id_string)
        |> assign(:user_id_bin, user_ctx.user_id_bin)
        |> assign(:username, user_ctx.username)
        |> assign(:role, user_ctx.role)
        |> assign(:avatar, user_ctx.avatar)
        |> assign(:avatar_style, user_ctx.avatar_style)
        |> assign(:permissions, user_ctx.permissions)

      # PERFORMANCE: Background Task untuk Sync (Non-blocking connect)
      # Menggunakan Task.Supervisor agar tidak mematikan socket jika proses DB gagal
      Task.Supervisor.start_child(ChatService.TaskSupervisor, fn ->
        perform_post_connect_sync(user_ctx)
      end)

      Logger.info("#{@audit_log_prefix} User #{user_id_string} connected successfully.")
      {:ok, socket}
    else
      {:error, :token_expired} ->
        Logger.warning("#{@audit_log_prefix} Connection rejected: Token Expired")
        :error

      {:error, reason} ->
        Logger.error("#{@audit_log_prefix} Critical rejection: #{inspect(reason)}")
        :error
    end
  end

  def connect(_, _, _), do: :error

  # =========================================================
  # SOCKET IDENTIFIER (Kunci untuk Disconnect Remote)
  # =========================================================
  @impl true
  def id(socket), do: "users_socket:#{socket.assigns.user_id}"

  # =========================================================
  # JWT SECURITY LAYER
  # =========================================================
  defp verify_and_validate_jwt(token), do: Auth.verify_jwt(token)

  # =========================================================
  # USER CONTEXT & ENRICHMENT
  # =========================================================
  defp build_enriched_context(%{"sub" => sub} = claims) when is_binary(sub) do
    # Gunakan Ecto.UUID.dump untuk konversi ke binary (Scylla/Cassandra Friendly)
    case Ecto.UUID.dump(sub) do
      {:ok, binary_uuid} ->
        fallback_username = claims["username"] || "user_#{String.slice(sub, -4..-1)}"
        fallback_avatar = claims["avatar"] || default_avatar(fallback_username)

        case IdentityClient.fetch_public_profile(sub) do
          {:ok, profile} ->
            username =
              IdentityClient.display_name(profile, fallback_username) ||
                fallback_username

            avatar =
              IdentityClient.avatar_url(profile, fallback_avatar) ||
                fallback_avatar

            {:ok,
             %{
               user_id_bin: binary_uuid,
               username: username,
               role: extract_primary_role(claims["roles"]),
               avatar: avatar,
               avatar_style: IdentityClient.avatar_style(profile),
               permissions: claims["perms"] || []
             }}

          _ ->
            {:ok,
             %{
               user_id_bin: binary_uuid,
               username: fallback_username,
               role: extract_primary_role(claims["roles"]),
               avatar: fallback_avatar,
               avatar_style: nil,
               permissions: claims["perms"] || []
             }}
        end

      :error ->
        {:error, :malformed_uuid}
    end
  end

  defp build_enriched_context(_), do: {:error, :missing_subject}

  # =========================================================
  # ASYNC SIDE EFFECTS (Performance Focused)
  # =========================================================
  defp perform_post_connect_sync(ctx) do
    # Menggabungkan operasi agar hemat resource
    try do
      # 1. Update User Projection (Write-optimized)
      sync_user_projection(ctx)

      # 2. Mark Online in Cache (In-memory/Redis)
      PresenceCache.mark_online(ctx.user_id_bin)
    rescue
      e -> Logger.error("#{@audit_log_prefix} Post-sync failed: #{inspect(e)}")
    end
  end

  defp sync_user_projection(%{user_id_bin: user_id, username: name, avatar: img}) do
    now = DateTime.utc_now()

    Repo.execute(
      """
      INSERT INTO users (user_id, display_name, avatar_url, last_active, updated_at)
      VALUES (?, ?, ?, ?, ?)
      """,
      [{"uuid", user_id}, {"text", name}, {"text", img}, {"timestamp", now}, {"timestamp", now}]
    )
  end

  # =========================================================
  # PURE HELPERS
  # =========================================================
  defp extract_primary_role([first | _]) when is_binary(first), do: first
  defp extract_primary_role(role) when is_binary(role), do: role
  defp extract_primary_role(_), do: "user"

  defp default_avatar(name) do
    # Generate avatar yang konsisten berdasarkan nama (UI UX friendly)
    "https://ui-avatars.com/api/?name=#{URI.encode(name)}&background=random&size=128"
  end
end
