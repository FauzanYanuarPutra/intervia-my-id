defmodule ChatService.Auth do
  @moduledoc false

  @max_clock_skew 300
  @public_jwk_key {__MODULE__, :public_jwk}
  @legacy_jwk_key {__MODULE__, :legacy_jwk}

  def verify_jwt(token) when is_binary(token) do
    with {:ok, claims} <- verify_signature(token),
         :ok <- validate_claims(claims) do
      {:ok, claims}
    end
  end

  def verify_jwt(_), do: {:error, :missing_token}

  defp verify_signature(token) do
    case jwt_alg(token) do
      "RS256" ->
        verify_rs256(token)

      "HS256" ->
        if Application.get_env(:chat_service, :jwt_allow_legacy_hs256, true) do
          verify_hs256(token)
        else
          {:error, :legacy_algorithm_disabled}
        end

      _ ->
        {:error, :unsupported_algorithm}
    end
  end

  defp jwt_alg(token) do
    with [encoded_header | _] <- String.split(token, "."),
         {:ok, header_json} <- Base.url_decode64(encoded_header, padding: false),
         {:ok, header} <- Jason.decode(header_json) do
      header["alg"]
    else
      _ -> nil
    end
  end

  defp verify_rs256(token) do
    case Application.get_env(:chat_service, :jwt_public_key_pem) do
      pem when is_binary(pem) and byte_size(pem) > 0 ->
        verify_with_jwk(public_jwk(pem), ["RS256"], token)

      _ ->
        {:error, :public_key_not_configured}
    end
  rescue
    _ -> {:error, :invalid_public_key}
  end

  defp verify_hs256(token) do
    case Application.get_env(:chat_service, :jwt_legacy_secret) do
      secret when is_binary(secret) and byte_size(secret) > 0 ->
        verify_with_jwk(legacy_jwk(secret), ["HS256"], token)

      _ ->
        {:error, :legacy_secret_not_configured}
    end
  end

  defp verify_with_jwk(jwk, algorithms, token) do
    case JOSE.JWT.verify_strict(jwk, algorithms, token) do
      {true, %JOSE.JWT{fields: claims}, _jws} when is_map(claims) -> {:ok, claims}
      _ -> {:error, :invalid_signature}
    end
  rescue
    _ -> {:error, :invalid_token}
  end

  defp public_jwk(pem) do
    cached_jwk(@public_jwk_key, pem, fn -> JOSE.JWK.from_pem(pem) end)
  end

  defp legacy_jwk(secret) do
    cached_jwk(@legacy_jwk_key, secret, fn -> JOSE.JWK.from_oct(secret) end)
  end

  defp cached_jwk(key, source, builder) do
    fingerprint = :crypto.hash(:sha256, source)

    case :persistent_term.get(key, nil) do
      {^fingerprint, jwk} ->
        jwk

      _ ->
        jwk = builder.()
        :persistent_term.put(key, {fingerprint, jwk})
        jwk
    end
  end

  defp validate_claims(claims) do
    issuer = Application.get_env(:chat_service, :jwt_issuer, "laju")
    audiences = Application.get_env(:chat_service, :jwt_audiences, ["chat_service"])
    now = System.system_time(:second)
    claim_iss = claims["iss"]
    claim_aud = claims["aud"]
    claim_exp = claims["exp"]

    cond do
      is_binary(claim_iss) and claim_iss != issuer ->
        {:error, :invalid_issuer}

      not is_integer(claim_exp) ->
        {:error, :invalid_exp}

      claim_exp < now - @max_clock_skew ->
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
