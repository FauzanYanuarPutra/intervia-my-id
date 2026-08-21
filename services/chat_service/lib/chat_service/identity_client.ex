defmodule ChatService.IdentityClient do
  @moduledoc false

  @default_base_url "http://identity_service:8080"
  @request_timeout 2_000

  def fetch_public_profile(user_id) do
    with user_id <- normalize_user_id(user_id),
         {:ok, base_url} <- base_url(),
         {:ok, status, body} <- request_public_profile(base_url, user_id),
         true <- status in 200..299,
         {:ok, payload} <- Jason.decode(body),
         profile when is_map(profile) <- normalize_profile(payload, user_id) do
      {:ok, profile}
    else
      {:ok, status, _body} -> {:error, {:http_status, status}}
      {:error, reason} -> {:error, reason}
      false -> {:error, :invalid_response}
      _ -> {:error, :invalid_response}
    end
  end

  def display_name(profile, fallback \\ nil) when is_map(profile) do
    profile[:full_name] ||
      profile[:username] ||
      profile["full_name"] ||
      profile["username"] ||
      fallback
  end

  def avatar_url(profile, fallback \\ nil) when is_map(profile) do
    profile[:avatar_url] ||
      profile["avatar_url"] ||
      fallback
  end

  def avatar_style(profile, fallback \\ nil) when is_map(profile) do
    profile[:avatar_style] ||
      profile["avatar_style"] ||
      fallback
  end

  defp normalize_user_id(user_id) when is_binary(user_id) do
    case Ecto.UUID.cast(user_id) do
      {:ok, uuid} -> uuid
      :error -> String.trim(user_id)
    end
  end

  defp normalize_user_id(user_id) when is_list(user_id) do
    user_id |> to_string() |> normalize_user_id()
  end

  defp normalize_user_id(user_id) do
    user_id
    |> to_string()
    |> normalize_user_id()
  end

  defp base_url do
    url =
      Application.get_env(:chat_service, :identity_service_url, @default_base_url)
      |> to_string()
      |> String.trim()
      |> String.trim_trailing("/")

    if url == "" do
      {:error, :missing_identity_service_url}
    else
      {:ok, url}
    end
  end

  defp request_public_profile(base_url, user_id) do
    path = "/users/public/" <> URI.encode(user_id)
    url = base_url <> path

    case :httpc.request(
           :get,
           {String.to_charlist(url), []},
           [timeout: @request_timeout, connect_timeout: @request_timeout],
           body_format: :binary
         ) do
      {:ok, {{_, status, _}, _headers, body}} ->
        {:ok, status, body}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp normalize_profile(%{} = payload, user_id) do
    %{
      id: Map.get(payload, "id", user_id),
      username: optional_text(Map.get(payload, "username")),
      full_name: optional_text(Map.get(payload, "full_name")),
      avatar_url: optional_text(Map.get(payload, "avatar_url")),
      avatar_style: Map.get(payload, "avatar_style")
    }
  end

  defp optional_text(value) when is_binary(value) do
    value = String.trim(value)
    if value == "", do: nil, else: value
  end

  defp optional_text(_), do: nil
end
