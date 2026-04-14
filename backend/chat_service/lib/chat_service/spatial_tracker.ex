# lib/chat_service/spatial_tracker.ex
defmodule ChatService.SpatialTracker do
  use GenServer
  require Logger

  @proximity_radius 150.0

  # Client API
  def start_link(_opts) do
    GenServer.start_link(__MODULE__, %{}, name: __MODULE__)
  end

  def update_position(room_id, user_id, x, y, metadata \\ %{}) do
    GenServer.cast(__MODULE__, {:update_position, room_id, user_id, x, y, metadata})
  end

  def get_nearby_users(room_id, center_x, center_y, radius \\ @proximity_radius) do
    GenServer.call(__MODULE__, {:get_nearby_users, room_id, center_x, center_y, radius})
  end

  def get_all_users_in_room(room_id) do
    GenServer.call(__MODULE__, {:get_all_users, room_id})
  end

  def remove_user(room_id, user_id) do
    GenServer.cast(__MODULE__, {:remove_user, room_id, user_id})
  end

  # Server callbacks
  @impl true
  def init(_opts) do
    state = %{
      # room_id => %{user_id => %{x, y, metadata}}
      rooms: %{}
    }
    {:ok, state}
  end

  @impl true
  def handle_cast({:update_position, room_id, user_id, x, y, metadata}, state) do
    room_users = Map.get(state.rooms, room_id, %{})
    updated_users = Map.put(room_users, user_id, %{
      x: x,
      y: y,
      metadata: metadata,
      updated_at: DateTime.utc_now()
    })
    updated_rooms = Map.put(state.rooms, room_id, updated_users)
    {:noreply, %{state | rooms: updated_rooms}}
  end

  @impl true
  def handle_cast({:remove_user, room_id, user_id}, state) do
    room_users = Map.get(state.rooms, room_id, %{})
    updated_users = Map.delete(room_users, user_id)
    updated_rooms = if map_size(updated_users) == 0 do
      Map.delete(state.rooms, room_id)
    else
      Map.put(state.rooms, room_id, updated_users)
    end
    {:noreply, %{state | rooms: updated_rooms}}
  end

  @impl true
  def handle_call({:get_nearby_users, room_id, center_x, center_y, radius}, _from, state) do
    room_users = Map.get(state.rooms, room_id, %{})
    
    nearby = room_users
    |> Enum.filter(fn {_user_id, pos} ->
      distance = calculate_distance(center_x, center_y, pos.x, pos.y)
      distance <= radius
    end)
    |> Enum.map(fn {user_id, pos} ->
      {user_id, %{
        x: pos.x,
        y: pos.y,
        distance: calculate_distance(center_x, center_y, pos.x, pos.y),
        metadata: pos.metadata
      }}
    end)
    
    {:reply, nearby, state}
  end

  @impl true
  def handle_call({:get_all_users, room_id}, _from, state) do
    users = Map.get(state.rooms, room_id, %{})
    |> Enum.map(fn {user_id, pos} ->
      {user_id, %{x: pos.x, y: pos.y, metadata: pos.metadata}}
    end)
    {:reply, users, state}
  end

  # Helper
  defp calculate_distance(x1, y1, x2, y2) do
    :math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1))
  end
end
