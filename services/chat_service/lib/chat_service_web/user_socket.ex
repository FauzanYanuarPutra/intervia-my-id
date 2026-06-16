defmodule ChatServiceWeb.UserSocket do
  use Phoenix.Socket

  alias ChatService.{Repo, PresenceCache, Guardian}
  require Logger

  # Channel definitions
  channel "room:*", ChatServiceWeb.RoomChannel
  channel "user:*", ChatServiceWeb.UserChannel
  channel "spatial:*", ChatServiceWeb.SpatialChannel

  # Configuration Constants
  @max_clock_skew 300 # 5 menit toleransi
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
  defp verify_and_validate_jwt(token) do
    # 1. Decode & Verify Signature
    case Guardian.decode_and_verify(token) do
      {:ok, claims} ->
        # 2. Deep Validation (Iss, Exp, Aud)
        validate_strict_claims(claims)
      {:error, reason} ->
        {:error, reason}
    end
  end

  defp validate_strict_claims(claims) do
    now = System.system_time(:second)
    issuer = Application.get_env(:chat_service, :jwt_issuer, "laju")
    audiences = Application.get_env(:chat_service, :jwt_audiences, ["chat_service", "laju_users"])
    claim_iss = claims["iss"]
    claim_aud = claims["aud"]
    claim_exp = claims["exp"]

    cond do
      # Validate issuer only when present to keep backward compatibility
      is_binary(claim_iss) and claim_iss != issuer ->
        {:error, :invalid_issuer}

      # Validate Expiry with clock-skew tolerance
      not is_integer(claim_exp) ->
        {:error, :invalid_exp}

      claim_exp < (now - @max_clock_skew) ->
        {:error, :token_expired}

      # Validate audience only when present
      not is_nil(claim_aud) and not audience_allowed?(claim_aud, audiences) ->
        {:error, :invalid_audience}

      true ->
        {:ok, claims}
    end
  end

  defp audience_allowed?(aud, allowed) when is_list(aud),
    do: Enum.any?(aud, &(&1 in allowed))

  defp audience_allowed?(aud, allowed) when is_binary(aud),
    do: aud in allowed

  defp audience_allowed?(_, _), do: false

  # =========================================================
  # USER CONTEXT & ENRICHMENT
  # =========================================================
  defp build_enriched_context(%{"sub" => sub} = claims) when is_binary(sub) do
    # Gunakan Ecto.UUID.dump untuk konversi ke binary (Scylla/Cassandra Friendly)
    case Ecto.UUID.dump(sub) do
      {:ok, binary_uuid} ->
        username = claims["username"] || "user_#{String.slice(sub, -4..-1)}"

        {:ok, %{
          user_id_bin: binary_uuid,
          username: username,
          role: extract_primary_role(claims["roles"]),
          avatar: claims["avatar"] || default_avatar(username),
          permissions: claims["perms"] || [] # Tambahan keamanan per-level
        }}
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
      INSERT INTO core.users (user_id, display_name, avatar_url, last_active, updated_at)
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
