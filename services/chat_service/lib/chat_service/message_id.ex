defmodule ChatService.MessageId do
  @moduledoc """
  Generates and validates Cassandra-compatible version-1 UUID message IDs.

  A message ID is created once by the application and reused for persistence,
  realtime delivery, API responses, and pagination cursors.
  """

  import Bitwise

  @uuid_epoch_offset_100ns 0x01B21DD213814000

  @spec generate() :: Ecto.UUID.t()
  @spec generate(DateTime.t()) :: Ecto.UUID.t()
  def generate(datetime \\ DateTime.utc_now())

  def generate(%DateTime{} = datetime) do
    timestamp = DateTime.to_unix(datetime, :microsecond) * 10 + @uuid_epoch_offset_100ns
    clock_sequence = random_unsigned(2) &&& 0x3FFF
    <<node_head, node_tail::binary-size(5)>> = :crypto.strong_rand_bytes(6)

    binary =
      <<timestamp &&& 0xFFFFFFFF::32, timestamp >>> 32 &&& 0xFFFF::16,
        (timestamp >>> 48 &&& 0x0FFF) ||| 0x1000::16, (clock_sequence >>> 8 &&& 0x3F) ||| 0x80::8,
        clock_sequence &&& 0xFF::8, node_head ||| 0x01::8, node_tail::binary>>

    encode(binary)
  end

  @spec dump(term()) :: {:ok, binary()} | :error
  def dump(value) do
    with {:ok, binary} <- Ecto.UUID.dump(value),
         true <- timeuuid_binary?(binary) do
      {:ok, binary}
    else
      _ -> :error
    end
  end

  @spec to_string(term()) :: {:ok, Ecto.UUID.t()} | :error
  def to_string(value) when is_binary(value) and byte_size(value) == 16 do
    if timeuuid_binary?(value), do: {:ok, encode(value)}, else: :error
  end

  def to_string(value) when is_binary(value) do
    case dump(value) do
      {:ok, binary} -> {:ok, encode(binary)}
      :error -> :error
    end
  end

  def to_string(_value), do: :error

  @spec bucket(term()) :: {:ok, integer()} | :error
  def bucket(value) do
    with {:ok, binary} <- dump(value),
         {:ok, datetime} <- datetime(binary) do
      {:ok, datetime.year * 100 + datetime.month}
    end
  end

  defp datetime(<<time_low::32, time_mid::16, time_high_and_version::16, _rest::binary-size(8)>>) do
    timestamp =
      (time_high_and_version &&& 0x0FFF) <<< 48 ||| time_mid <<< 32 ||| time_low

    unix_microseconds = div(timestamp - @uuid_epoch_offset_100ns, 10)
    DateTime.from_unix(unix_microseconds, :microsecond)
  end

  defp timeuuid_binary?(<<_::48, 1::4, _::12, 2::2, _::62>>), do: true
  defp timeuuid_binary?(_binary), do: false

  defp encode(binary) do
    hex = Base.encode16(binary, case: :lower)

    <<a::binary-size(8), b::binary-size(4), c::binary-size(4), d::binary-size(4),
      e::binary-size(12)>> = hex

    Enum.join([a, b, c, d, e], "-")
  end

  defp random_unsigned(bytes) do
    :crypto.strong_rand_bytes(bytes)
    |> :binary.decode_unsigned()
  end
end
