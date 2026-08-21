defmodule ChatService.AttachmentPolicy do
  @moduledoc """
  Canonical validation for user-controlled chat attachments.

  Binary media must point at an application-controlled media path. Rich chat
  cards remain JSON, but are bounded and any URL-like fields are reduced to
  same-origin application routes or configured MinIO media paths. This module
  is shared by HTTP and websocket sends so retries hash the same payload.
  """

  @max_attachments 10
  @max_media_url_bytes 2_048
  @max_structured_bytes 32 * 1_024
  @max_depth 8
  @max_nodes 320
  @max_object_keys 96
  @max_array_items 64
  @max_key_bytes 96
  @max_string_bytes 4_096

  @media_types ~w(image video audio file)
  @structured_types ~w(
    location offer transaction application listing invite order milestone
    ride_update delivery_update job_update
  )

  @safe_internal_prefixes [
    "/content/",
    "/profile/",
    "/transactions",
    "/create/",
    "/id/content/",
    "/en/content/",
    "/id/profile/",
    "/en/profile/",
    "/id/transactions",
    "/en/transactions",
    "/id/create/",
    "/en/create/"
  ]

  @safe_media_prefixes [
    "/api/chat/media/",
    "/api/content/media/",
    "/images/",
    "/uploads/chat/",
    "/uploads/content/"
  ]

  @unsafe_keys MapSet.new(~w(__proto__ prototype constructor))

  @type error_reason :: :invalid_attachments

  @spec normalize(term(), term()) :: {:ok, [String.t()]} | {:error, error_reason()}
  def normalize(message_type, attachments) do
    type = normalize_type(message_type)

    with {:ok, list} <- attachment_list(attachments),
         true <- length(list) <= @max_attachments do
      normalize_for_type(type, list)
    else
      _ -> {:error, :invalid_attachments}
    end
  end

  @doc false
  @spec safe_media_reference(term()) :: {:ok, String.t()} | :error
  def safe_media_reference(value) when is_binary(value) do
    value = String.trim(value)

    cond do
      value == "" or byte_size(value) > @max_media_url_bytes ->
        :error

      safe_media_path?(value) ->
        {:ok, value}

      true ->
        canonicalize_allowed_absolute(value, :media)
    end
  end

  def safe_media_reference(_value), do: :error

  defp normalize_for_type("sticker", []), do: {:ok, []}
  defp normalize_for_type("sticker", _list), do: {:error, :invalid_attachments}

  defp normalize_for_type(type, list) when type in @media_types do
    map_all(list, &safe_media_reference/1)
  end

  defp normalize_for_type(type, list) when type in @structured_types do
    if length(list) <= 1, do: normalize_structured(list), else: {:error, :invalid_attachments}
  end

  defp normalize_for_type(_type, []), do: {:ok, []}
  defp normalize_for_type(_type, _list), do: {:error, :invalid_attachments}

  defp normalize_structured([]), do: {:ok, []}

  defp normalize_structured([raw]) when is_binary(raw) do
    value = String.trim(raw)

    with true <- value != "" and byte_size(value) <= @max_structured_bytes,
         {:ok, parsed} <- Jason.decode(value),
         true <- is_map(parsed),
         {:ok, sanitized, _nodes} <- sanitize_json(parsed, nil, 0, 0),
         true <- map_size(sanitized) > 0,
         {:ok, encoded} <- Jason.encode(sanitized),
         true <- byte_size(encoded) <= @max_structured_bytes do
      {:ok, [encoded]}
    else
      _ -> {:error, :invalid_attachments}
    end
  end

  defp normalize_structured(_list), do: {:error, :invalid_attachments}

  defp sanitize_json(_value, _parent_key, depth, nodes)
       when depth > @max_depth or nodes >= @max_nodes,
       do: {:error, :invalid_attachments}

  defp sanitize_json(value, parent_key, _depth, nodes) when is_binary(value) do
    cond do
      byte_size(value) > @max_string_bytes ->
        {:error, :invalid_attachments}

      String.contains?(value, <<0>>) ->
        {:error, :invalid_attachments}

      url_key?(parent_key) ->
        case safe_structured_reference(value) do
          {:ok, normalized} -> {:ok, normalized, nodes + 1}
          :drop -> {:drop, nodes + 1}
        end

      true ->
        {:ok, value, nodes + 1}
    end
  end

  defp sanitize_json(value, _parent_key, _depth, nodes)
       when is_boolean(value) or is_nil(value) or is_integer(value),
       do: {:ok, value, nodes + 1}

  defp sanitize_json(value, _parent_key, _depth, nodes) when is_float(value) do
    if value == value and value not in [:infinity, :neg_infinity],
      do: {:ok, value, nodes + 1},
      else: {:error, :invalid_attachments}
  end

  defp sanitize_json(value, parent_key, depth, nodes) when is_list(value) do
    if length(value) > @max_array_items do
      {:error, :invalid_attachments}
    else
      Enum.reduce_while(value, {:ok, [], nodes + 1}, fn item, {:ok, acc, count} ->
        case sanitize_json(item, parent_key, depth + 1, count) do
          {:ok, sanitized, next_count} -> {:cont, {:ok, [sanitized | acc], next_count}}
          {:drop, next_count} -> {:cont, {:ok, acc, next_count}}
          {:error, _reason} = error -> {:halt, error}
        end
      end)
      |> case do
        {:ok, sanitized, count} -> {:ok, Enum.reverse(sanitized), count}
        error -> error
      end
    end
  end

  defp sanitize_json(value, _parent_key, depth, nodes) when is_map(value) do
    if map_size(value) > @max_object_keys do
      {:error, :invalid_attachments}
    else
      value
      |> Enum.sort_by(fn {key, _value} -> to_string(key) end)
      |> Enum.reduce_while({:ok, %{}, nodes + 1}, fn {raw_key, item}, {:ok, acc, count} ->
        key = to_string(raw_key)

        cond do
          byte_size(key) == 0 or byte_size(key) > @max_key_bytes ->
            {:halt, {:error, :invalid_attachments}}

          MapSet.member?(@unsafe_keys, String.downcase(key)) ->
            {:halt, {:error, :invalid_attachments}}

          true ->
            case sanitize_json(item, key, depth + 1, count) do
              {:ok, sanitized, next_count} ->
                {:cont, {:ok, Map.put(acc, key, sanitized), next_count}}

              {:drop, next_count} ->
                {:cont, {:ok, acc, next_count}}

              {:error, _reason} = error ->
                {:halt, error}
            end
        end
      end)
    end
  end

  defp sanitize_json(_value, _parent_key, _depth, _nodes),
    do: {:error, :invalid_attachments}

  defp safe_structured_reference(value) do
    value = String.trim(value)

    cond do
      value == "" -> {:ok, ""}
      safe_media_path?(value) -> {:ok, value}
      safe_internal_path?(value) -> {:ok, value}
      true -> canonicalize_allowed_absolute(value, :structured) |> drop_on_error()
    end
  end

  defp drop_on_error({:ok, value}), do: {:ok, value}
  defp drop_on_error(:error), do: :drop

  defp canonicalize_allowed_absolute(value, kind) do
    with %URI{scheme: scheme, host: host, userinfo: nil} = uri <- URI.parse(value),
         true <- scheme in ["https", "http"] and is_binary(host),
         true <- allowed_origin?(uri),
         path when is_binary(path) <- uri.path,
         true <- is_nil(uri.fragment) do
      query =
        if is_binary(uri.query) and byte_size(uri.query) <= 512, do: "?" <> uri.query, else: ""

      cond do
        safe_media_path?(path) -> {:ok, path}
        kind == :structured and safe_internal_path?(path) -> {:ok, path <> query}
        true -> canonicalize_minio_path(uri)
      end
    else
      _ -> :error
    end
  rescue
    _ -> :error
  end

  defp canonicalize_minio_path(uri) do
    with base when is_binary(base) <- System.get_env("MINIO_PUBLIC_URL"),
         %URI{scheme: scheme, host: host} = base_uri <- URI.parse(String.trim(base)),
         true <-
           scheme == uri.scheme and host == uri.host and
             effective_port(base_uri) == effective_port(uri),
         {:ok, relative_path} <- strip_base_path(uri.path || "", base_uri.path || ""),
         {:ok, proxy_path} <- minio_proxy_path(relative_path) do
      {:ok, proxy_path}
    else
      _ -> :error
    end
  end

  defp strip_base_path(path, base_path) do
    prefix = String.trim_trailing(base_path, "/")

    cond do
      prefix == "" -> {:ok, path}
      path == prefix -> {:ok, "/"}
      String.starts_with?(path, prefix <> "/") -> {:ok, String.replace_prefix(path, prefix, "")}
      true -> :error
    end
  end

  defp minio_proxy_path(path) do
    segments = path_segments(path)

    case segments do
      [bucket, "chat" | rest] when length(rest) >= 2 ->
        candidate = "/api/chat/media/" <> Enum.join([bucket, "chat" | rest], "/")
        if safe_media_path?(candidate), do: {:ok, candidate}, else: :error

      [bucket, root | rest] when root in ["content", "forum"] and rest != [] ->
        candidate = "/api/content/media/" <> Enum.join([bucket, root | rest], "/")
        if safe_media_path?(candidate), do: {:ok, candidate}, else: :error

      _ ->
        :error
    end
  end

  defp allowed_origin?(uri) do
    configured_origins()
    |> Enum.any?(fn configured ->
      configured.scheme == uri.scheme and configured.host == uri.host and
        effective_port(configured) == effective_port(uri)
    end)
  end

  defp configured_origins do
    [
      System.get_env("CHAT_MEDIA_ALLOWED_ORIGINS"),
      System.get_env("CORS_ORIGINS"),
      System.get_env("MINIO_PUBLIC_URL")
    ]
    |> Enum.reject(&is_nil/1)
    |> Enum.flat_map(&String.split(&1, ","))
    |> Enum.map(&String.trim/1)
    |> Enum.reject(&(&1 == ""))
    |> Enum.map(&URI.parse/1)
    |> Enum.filter(&(is_binary(&1.scheme) and is_binary(&1.host) and &1.userinfo == nil))
  end

  defp effective_port(%URI{port: port}) when is_integer(port), do: port
  defp effective_port(%URI{scheme: "https"}), do: 443
  defp effective_port(%URI{scheme: "http"}), do: 80
  defp effective_port(_uri), do: nil

  defp safe_media_path?(value) do
    safe_path?(value, @safe_media_prefixes) and
      media_shape_valid?(path_segments(URI.parse(value).path || ""))
  rescue
    _ -> false
  end

  defp media_shape_valid?(["api", "chat", "media", "local", "uploads", "chat", room, file | rest]),
    do: room != "" and file != "" and rest == []

  defp media_shape_valid?(["api", "chat", "media", bucket, "chat", room, file | rest]),
    do: bucket != "" and room != "" and file != "" and rest == []

  defp media_shape_valid?(["api", "content", "media", bucket, root, file | rest])
       when root in ["content", "forum"],
       do: bucket != "" and file != "" and rest == []

  defp media_shape_valid?(["uploads", root | rest]) when root in ["chat", "content"],
    do: length(rest) >= 2

  defp media_shape_valid?(["images" | rest]), do: rest != []

  defp media_shape_valid?(_segments), do: false

  defp safe_internal_path?(value), do: safe_path?(value, @safe_internal_prefixes)

  defp safe_path?(value, prefixes) do
    is_binary(value) and byte_size(value) <= @max_media_url_bytes and
      String.starts_with?(value, "/") and not String.starts_with?(value, "//") and
      not String.contains?(value, ["\\", <<0>>, "\r", "\n"]) and
      Enum.any?(prefixes, &String.starts_with?(value, &1)) and
      safe_path_segments?(URI.parse(value).path || "")
  rescue
    _ -> false
  end

  defp safe_path_segments?(path) do
    path_segments(path) != [] and
      Enum.all?(path_segments(path), fn segment ->
        decoded = URI.decode(segment)

        decoded not in ["", ".", ".."] and not String.contains?(decoded, ["/", "\\", <<0>>]) and
          byte_size(decoded) <= 180
      end)
  rescue
    _ -> false
  end

  defp path_segments(path), do: String.split(path, "/", trim: true)

  defp url_key?(nil), do: false

  defp url_key?(key) do
    key = String.downcase(to_string(key))

    key in ["url", "uri", "href", "link", "cover_image", "image", "avatar"] or
      Enum.any?(["_url", "_urls", "_uri", "_uris", "_href", "_link"], &String.ends_with?(key, &1))
  end

  defp attachment_list(nil), do: {:ok, []}
  defp attachment_list(value) when is_list(value), do: {:ok, value}
  defp attachment_list(value) when is_binary(value), do: {:ok, [value]}
  defp attachment_list(_value), do: {:error, :invalid_attachments}

  defp map_all(values, fun) do
    Enum.reduce_while(values, {:ok, []}, fn value, {:ok, acc} ->
      case fun.(value) do
        {:ok, normalized} -> {:cont, {:ok, [normalized | acc]}}
        _ -> {:halt, {:error, :invalid_attachments}}
      end
    end)
    |> case do
      {:ok, normalized} -> {:ok, Enum.reverse(normalized)}
      error -> error
    end
  end

  defp normalize_type(type) when is_binary(type), do: type |> String.trim() |> String.downcase()
  defp normalize_type(_type), do: "text"
end
