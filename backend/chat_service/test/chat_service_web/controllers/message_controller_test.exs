defmodule ChatServiceWeb.MessageControllerTest do
  use ExUnit.Case, async: true
  use Phoenix.ConnTest

  @endpoint ChatServiceWeb.Endpoint

  describe "create/2" do
    test "returns 400 when content is empty" do
      conn =
        build_conn(:post, "/api/v1/rooms/dm:a:b/messages", %{content: ""})
        |> Plug.Conn.assign(:current_user_id_bin, <<0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1>>)
        |> Plug.Conn.assign(:current_user_id, "00000000-0000-0000-0000-000000000001")
        |> put_private(:phoenix_format, "json")

      conn = %{conn | params: Map.merge(conn.params || %{}, %{"room_id" => "dm:a:b", "content" => ""})}
      conn = ChatServiceWeb.MessageController.create(conn, conn.params)

      assert conn.status == 400
      assert conn.resp_body =~ "content is required"
    end
  end
end
