# lib/chat_service_web/channels/user_channel.ex
defmodule ChatServiceWeb.UserChannel do
  use ChatServiceWeb, :channel

  # User hanya boleh join channel "user:<own_user_id>" untuk menerima inbox_updated
  @impl true
  def join("user:" <> user_id, _params, socket) do
    if user_id == socket.assigns.user_id do
      {:ok, socket}
    else
      {:error, %{reason: "unauthorized"}}
    end
  end

  @impl true
  def handle_out(event, payload, socket) do
    push(socket, event, payload)
    {:noreply, socket}
  end
end
