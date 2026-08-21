defmodule ChatService.PresenceCache do
  @moduledoc false

  @table :presence_cache

  def init do
    if :ets.whereis(@table) == :undefined do
      :ets.new(@table, [
        :set,
        :public,
        :named_table,
        read_concurrency: true,
        write_concurrency: true
      ])
    end

    :ok
  end

  def mark_online(user_id_bin) do
    :ets.insert(@table, {user_id_bin, System.system_time(:second)})
    :ok
  end

  def mark_offline(user_id_bin) do
    :ets.delete(@table, user_id_bin)
    :ok
  end

  def online?(user_id_bin) do
    :ets.lookup(@table, user_id_bin) != []
  end
end
