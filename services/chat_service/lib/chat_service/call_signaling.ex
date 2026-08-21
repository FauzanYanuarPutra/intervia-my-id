defmodule ChatService.CallSignaling do
  @moduledoc false

  @spec start_call_id(term()) :: {:ok, Ecto.UUID.t()} | {:error, :invalid_call_id}
  def start_call_id(nil), do: {:ok, Ecto.UUID.generate()}
  def start_call_id(""), do: {:ok, Ecto.UUID.generate()}

  def start_call_id(value) do
    case call_id(value) do
      {:ok, canonical} -> {:ok, canonical}
      {:error, :invalid_call_id} -> {:ok, Ecto.UUID.generate()}
    end
  end

  @spec call_id(term()) :: {:ok, Ecto.UUID.t()} | {:error, :invalid_call_id}
  def call_id(value) when is_binary(value) and byte_size(value) <= 64 do
    case Ecto.UUID.cast(String.trim(value)) do
      {:ok, canonical} -> {:ok, canonical}
      :error -> {:error, :invalid_call_id}
    end
  end

  def call_id(_value), do: {:error, :invalid_call_id}

  @spec json_object(term(), pos_integer()) :: {:ok, String.t()} | {:error, :invalid_signal}
  def json_object(value, max_bytes)
      when is_binary(value) and is_integer(max_bytes) and max_bytes > 0 do
    if String.valid?(value) and byte_size(value) <= max_bytes do
      case Jason.decode(value) do
        {:ok, decoded} when is_map(decoded) -> {:ok, value}
        _ -> {:error, :invalid_signal}
      end
    else
      {:error, :invalid_signal}
    end
  end

  def json_object(_value, _max_bytes), do: {:error, :invalid_signal}
end
