defmodule ChatService.Auth do
  @moduledoc false

  alias ChatService.Guardian

  @max_clock_skew 300

  def verify_jwt(token) when is_binary(token) do
    with {:ok, claims} <- Guardian.decode_and_verify(token),
         :ok <- validate_claims(claims) do
      {:ok, claims}
    end
  end

  def verify_jwt(_), do: {:error, :missing_token}

  defp validate_claims(claims) do
    issuer = Application.get_env(:chat_service, :jwt_issuer, "laju")
    audiences = Application.get_env(:chat_service, :jwt_audiences, ["chat_service"])
    now = System.system_time(:second)
    claim_iss = claims["iss"]
    claim_aud = claims["aud"]

    cond do
      is_binary(claim_iss) and claim_iss != issuer ->
        {:error, :invalid_issuer}

      claims["exp"] < (now - @max_clock_skew) ->
        {:error, :token_expired}

      not is_nil(claim_aud) and not audience_allowed?(claim_aud, audiences) ->
        {:error, :invalid_audience}

      true ->
        :ok
    end
  end

  defp audience_allowed?(aud, allowed) when is_list(aud),
    do: Enum.any?(aud, &(&1 in allowed))

  defp audience_allowed?(aud, allowed) when is_binary(aud),
    do: aud in allowed

  defp audience_allowed?(_, _), do: false
end

