defmodule ChatService.MessageHistory do
  @moduledoc """
  Builds bounded message-history queries without weakening room semantics.

  Group members may only read messages created at or after their membership's
  `joined_at` timestamp. Direct and support rooms retain their existing shared
  history behavior.
  """

  @spec build_query(
          binary(),
          integer(),
          binary() | nil,
          pos_integer(),
          binary(),
          DateTime.t() | NaiveDateTime.t() | nil
        ) :: {:ok, {binary(), list()}} | {:error, :missing_joined_at}
  def build_query(room_id, bucket, before_id, limit, "group", %DateTime{} = joined_at) do
    build_group_query(room_id, bucket, before_id, limit, joined_at)
  end

  def build_query(room_id, bucket, before_id, limit, "group", %NaiveDateTime{} = joined_at) do
    build_group_query(
      room_id,
      bucket,
      before_id,
      limit,
      DateTime.from_naive!(joined_at, "Etc/UTC")
    )
  end

  def build_query(_room_id, _bucket, _before_id, _limit, "group", _joined_at) do
    {:error, :missing_joined_at}
  end

  def build_query(room_id, bucket, nil, limit, _room_type, _joined_at) do
    {:ok,
     {
       "SELECT * FROM messages WHERE room_id = ? AND bucket = ? ORDER BY message_id DESC LIMIT ?",
       [{"text", room_id}, {"int", bucket}, {"int", limit}]
     }}
  end

  def build_query(room_id, bucket, before_id, limit, _room_type, _joined_at) do
    {:ok,
     {
       "SELECT * FROM messages WHERE room_id = ? AND bucket = ? AND message_id < ? ORDER BY message_id DESC LIMIT ?",
       [
         {"text", room_id},
         {"int", bucket},
         {"timeuuid", before_id},
         {"int", limit}
       ]
     }}
  end

  defp build_group_query(room_id, bucket, nil, limit, joined_at) do
    {:ok,
     {
       "SELECT * FROM messages WHERE room_id = ? AND bucket = ? AND message_id >= minTimeuuid(?) ORDER BY message_id DESC LIMIT ?",
       [
         {"text", room_id},
         {"int", bucket},
         {"timestamp", joined_at},
         {"int", limit}
       ]
     }}
  end

  defp build_group_query(room_id, bucket, before_id, limit, joined_at) do
    {:ok,
     {
       "SELECT * FROM messages WHERE room_id = ? AND bucket = ? AND message_id < ? AND message_id >= minTimeuuid(?) ORDER BY message_id DESC LIMIT ?",
       [
         {"text", room_id},
         {"int", bucket},
         {"timeuuid", before_id},
         {"timestamp", joined_at},
         {"int", limit}
       ]
     }}
  end
end
