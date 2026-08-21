defmodule ChatService.RoomAccess do
  @moduledoc false

  @manager_roles ~w(owner admin)

  @spec manager_role?(term()) :: boolean()
  def manager_role?(role) when is_binary(role) do
    String.downcase(String.trim(role)) in @manager_roles
  end

  def manager_role?(_role), do: false
end
