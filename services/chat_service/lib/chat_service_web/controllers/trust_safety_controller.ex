defmodule ChatServiceWeb.TrustSafetyController do
  use ChatServiceWeb, :controller

  alias ChatService.{DmRoom, RateLimiter, TrustSafety}

  require Logger

  @block_action_limit 30
  @block_action_window_ms 15 * 60 * 1_000
  @block_status_limit 120
  @block_status_window_ms 15 * 60 * 1_000
  @report_limit 10
  @report_window_ms 60 * 60 * 1_000

  def block(conn, %{"blocked_user_id" => blocked_user_id}) do
    current_user_id_bin = conn.assigns.current_user_id_bin

    with :ok <- rate_limit(:block_action, current_user_id_bin),
         {:ok, blocked_user_id_bin} <- parse_user_id(blocked_user_id),
         :ok <- DmRoom.validate_not_self(current_user_id_bin, blocked_user_id_bin),
         :ok <- TrustSafety.block_user(current_user_id_bin, blocked_user_id_bin) do
      json(conn, %{
        data: %{
          blocked_user_id: Ecto.UUID.cast!(blocked_user_id_bin),
          blocked: true
        }
      })
    else
      error -> block_error(conn, error)
    end
  end

  def block(conn, _params), do: invalid(conn, "blocked_user_id is required", "invalid_user_id")

  def unblock(conn, %{"blocked_user_id" => blocked_user_id}) do
    current_user_id_bin = conn.assigns.current_user_id_bin

    with :ok <- rate_limit(:block_action, current_user_id_bin),
         {:ok, blocked_user_id_bin} <- parse_user_id(blocked_user_id),
         :ok <- DmRoom.validate_not_self(current_user_id_bin, blocked_user_id_bin),
         :ok <- TrustSafety.unblock_user(current_user_id_bin, blocked_user_id_bin) do
      json(conn, %{
        data: %{
          blocked_user_id: Ecto.UUID.cast!(blocked_user_id_bin),
          blocked: false
        }
      })
    else
      error -> block_error(conn, error)
    end
  end

  def block_status(conn, %{"blocked_user_id" => blocked_user_id}) do
    current_user_id_bin = conn.assigns.current_user_id_bin

    with :ok <- rate_limit(:block_status, current_user_id_bin),
         {:ok, blocked_user_id_bin} <- parse_user_id(blocked_user_id),
         :ok <- DmRoom.validate_not_self(current_user_id_bin, blocked_user_id_bin),
         {:ok, blocked?} <- TrustSafety.blocked_by?(current_user_id_bin, blocked_user_id_bin) do
      json(conn, %{
        data: %{
          blocked_user_id: Ecto.UUID.cast!(blocked_user_id_bin),
          blocked: blocked?
        }
      })
    else
      error -> block_error(conn, error)
    end
  end

  def report(conn, %{"room_id" => room_id_raw} = params) do
    reporter_id_bin = conn.assigns.current_user_id_bin

    with :ok <- rate_limit(:report, reporter_id_bin),
         {:ok, room_id} <- room_id_raw |> safe_decode() |> TrustSafety.normalize_room_id(),
         {:ok, report} <- TrustSafety.normalize_report(params),
         {:ok, true} <- TrustSafety.member?(room_id, reporter_id_bin),
         {:ok, result} <- TrustSafety.create_report(reporter_id_bin, room_id, report) do
      conn
      |> put_status(:created)
      |> json(%{data: result})
    else
      error -> report_error(conn, error)
    end
  end

  def report(conn, _params), do: invalid(conn, "room_id is required", "invalid_room_id")

  defp parse_user_id(value) when is_binary(value) do
    case Ecto.UUID.dump(String.trim(value)) do
      {:ok, user_id_bin} -> {:ok, user_id_bin}
      :error -> {:error, :invalid_user_id}
    end
  end

  defp parse_user_id(_value), do: {:error, :invalid_user_id}

  defp rate_limit(:block_action, user_id_bin) do
    RateLimiter.check(
      {:trust_safety, :block_action, user_id_bin},
      @block_action_limit,
      @block_action_window_ms
    )
  end

  defp rate_limit(:block_status, user_id_bin) do
    RateLimiter.check(
      {:trust_safety, :block_status, user_id_bin},
      @block_status_limit,
      @block_status_window_ms
    )
  end

  defp rate_limit(:report, user_id_bin) do
    RateLimiter.check({:trust_safety, :report, user_id_bin}, @report_limit, @report_window_ms)
  end

  defp block_error(conn, {:error, :self_chat}) do
    invalid(conn, "cannot block yourself", "self_block_not_allowed")
  end

  defp block_error(conn, {:error, :invalid_user_id}) do
    invalid(conn, "invalid blocked_user_id", "invalid_user_id")
  end

  defp block_error(conn, {:error, :rate_limited}), do: rate_limited(conn)
  defp block_error(conn, {:error, :storage_unavailable}), do: storage_unavailable(conn)
  defp block_error(conn, _error), do: invalid(conn, "invalid request", "invalid_request")

  defp report_error(conn, {:ok, false}), do: not_found(conn)

  defp report_error(conn, {:error, :invalid_room_id}) do
    invalid(conn, "invalid room_id", "invalid_room_id")
  end

  defp report_error(conn, {:error, :invalid_reason}) do
    invalid(conn, "invalid report reason", "invalid_reason")
  end

  defp report_error(conn, {:error, :invalid_details}) do
    invalid(conn, "report details are too long", "invalid_details")
  end

  defp report_error(conn, {:error, :invalid_message_id}) do
    invalid(conn, "invalid message_id", "invalid_message_id")
  end

  defp report_error(conn, {:error, :message_not_found}), do: not_found(conn)
  defp report_error(conn, {:error, :rate_limited}), do: rate_limited(conn)
  defp report_error(conn, {:error, :storage_unavailable}), do: storage_unavailable(conn)
  defp report_error(conn, _error), do: invalid(conn, "invalid request", "invalid_request")

  defp safe_decode(value) when is_binary(value) do
    try do
      URI.decode(value)
    rescue
      _error -> ""
    end
  end

  defp safe_decode(_value), do: ""

  defp invalid(conn, message, code) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: message, code: code})
  end

  defp not_found(conn) do
    conn
    |> put_status(:not_found)
    |> json(%{error: "room or message not found", code: "report_target_not_found"})
  end

  defp rate_limited(conn) do
    conn
    |> put_status(:too_many_requests)
    |> json(%{error: "too many trust and safety actions", code: "rate_limited"})
  end

  defp storage_unavailable(conn) do
    Logger.error("Chat trust and safety storage unavailable")

    conn
    |> put_status(:service_unavailable)
    |> json(%{error: "chat service unavailable", code: "service_unavailable"})
  end
end
