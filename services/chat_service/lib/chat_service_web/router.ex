defmodule ChatServiceWeb.Router do
  use ChatServiceWeb, :router

  pipeline :api do
    plug :accepts, ["json"]
    plug Plug.Telemetry, event_prefix: [:phoenix, :endpoint]
  end

  pipeline :authenticated do
    plug ChatServiceWeb.Plugs.Auth
  end

  scope "/api/v1", ChatServiceWeb do
    pipe_through [:api, :authenticated]

    # Create or fetch deterministic DM room by peer user id.
    post "/dm", DmController, :create

    # Group rooms (multi-member)
    post "/rooms", RoomController, :create
    post "/rooms/:room_id/members", RoomController, :add_members
    get "/rooms/:room_id/members", RoomController, :members

    # Support rooms (ticket-based)
    post "/support/rooms", SupportRoomController, :create
    post "/support/rooms/:room_id/members", SupportRoomController, :add_members

    # Endpoint history yang efisien
    get "/rooms/:room_id/messages", MessageController, :index
    post "/rooms/:room_id/messages", MessageController, :create
    post "/rooms/:room_id/read", MessageController, :read

    # Endpoint untuk daftar chat di sidebar (inbox)
    get "/inbox", InboxController, :index
  end
end
