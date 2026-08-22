defmodule ChatService.Guardian do
  use Guardian, otp_app: :chat_service

  # WAJIB ADA: Mengubah data user menjadi string 'sub' di JWT
  def subject_for_token(resource, _claims) do
    sub = to_string(resource.id)
    {:ok, sub}
  end

  # WAJIB ADA: Mengambil data user dari 'sub' di JWT
  def resource_from_claims(claims) do
    {:ok,
     %{
       id: claims["sub"],
       username: claims["username"],
       roles: claims["roles"]
     }}
  end
end
