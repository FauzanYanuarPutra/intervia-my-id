defmodule ChatService.PushNotifier do
  @moduledoc false

  require Logger

  def incoming_call(payload) when is_map(payload) do
    post(Map.put(payload, :type, "incoming_call"))
  end

  def call_cleanup(payload) when is_map(payload) do
    post(Map.put(payload, :type, "call_end"))
  end

  defp post(payload) do
    url = System.get_env("INTERNAL_PUSH_URL", "") |> String.trim()
    secret = System.get_env("INTERNAL_PUSH_SECRET", "")

    if url == "" or secret == "" do
      :disabled
    else
      body = Jason.encode!(payload)

      request =
        {
          String.to_charlist(url),
          [
            {~c"content-type", ~c"application/json"},
            {~c"x-internal-push-secret", String.to_charlist(secret)}
          ],
          ~c"application/json",
          body
        }

      case :httpc.request(
             :post,
             request,
             [timeout: 5_000, connect_timeout: 2_000],
             []
           ) do
        {:ok, {{_version, status, _reason}, _headers, _response_body}}
        when status in 200..299 ->
          :ok

        {:ok, {{_version, status, _reason}, _headers, _response_body}} ->
          Logger.warning("[PushNotifier] push gateway returned #{status}")
          {:error, {:http_status, status}}

        {:error, reason} ->
          Logger.warning("[PushNotifier] push gateway request failed: #{inspect(reason)}")

          {:error, reason}
      end
    end
  rescue
    error ->
      Logger.warning("[PushNotifier] push gateway crashed: #{inspect(error)}")
      {:error, error}
  end
end
