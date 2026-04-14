defmodule ChatService.AidaBot do
  @moduledoc false

  @support_room_id "support:aida"
  @bot_id "2b173810-4517-49cd-899f-a1da00000001"
  @bot_name "Aida Support"
  @bot_avatar "https://ui-avatars.com/api/?name=Aida+Support&background=0f766e&color=ffffff&size=128"

  def support_room_id, do: @support_room_id
  def bot_id, do: @bot_id
  def bot_name, do: @bot_name
  def bot_avatar, do: @bot_avatar

  def should_reply?(room_id, sender_id) do
    normalized_room = room_id |> to_string() |> String.trim()
    normalized_sender = sender_id |> to_string() |> String.trim() |> String.downcase()

    support_room? =
      normalized_room == @support_room_id or String.starts_with?(normalized_room, "support:")

    support_room? and normalized_sender != "" and normalized_sender != String.downcase(@bot_id)
  end

  def build_reply(content, opts \\ []) do
    text = content |> to_string() |> String.trim()
    lower = String.downcase(text)
    message_type = opts |> Keyword.get(:message_type, "text") |> to_string() |> String.downcase()
    attachments = opts |> Keyword.get(:attachments, [])

    cond do
      text == "" and is_list(attachments) and attachments != [] ->
        "Aida aktif 24/7. File sudah saya terima. Tolong jelaskan kendalanya biar saya bantu lebih cepat."

      text == "" and message_type in ["image", "video", "audio", "file", "sticker"] ->
        "Aida aktif 24/7. Media sudah masuk. Tambahkan detail masalahnya ya."

      greeting?(lower) ->
        "Halo, saya Aida Support. Saya siap bantu 24/7. Ceritakan masalahmu, nanti saya arahkan solusi atau eskalasi ke agent."

      contains_any?(lower, ["login", "masuk", "otp", "password", "akun", "verifikasi"]) ->
        "Untuk kendala login/akun: 1) cek email/nomor sudah benar, 2) tunggu OTP 1-2 menit, 3) gunakan menu lupa password. Kalau masih gagal, kirim email akun + jam kejadian."

      contains_any?(lower, [
        "saldo",
        "wallet",
        "topup",
        "top up",
        "isi saldo",
        "deposit"
      ]) ->
        "Untuk isi saldo: buka menu Wallet / Payments (path: /payments), pilih environment (development atau live), isi nominal, pilih provider Midtrans, lalu pilih metode (GoPay, QRIS, BCA VA, Mandiri VA, BNI VA, BRI VA, dll) dan lanjutkan checkout. Jika pending/gagal, kirim top-up ID + provider + jam transaksi agar saya bantu cek."

      contains_any?(lower, [
        "development",
        "dev",
        "sandbox",
        "test"
      ]) and contains_any?(lower, ["saldo", "wallet", "topup", "top up"]) ->
        "Saldo development terpisah dari live. Jika top-up dev masih pending, gunakan aksi settle-dev agar saldo simulasi langsung masuk. Dana development tidak bisa dipakai sebagai dana real."

      contains_any?(lower, [
        "live",
        "real",
        "asli",
        "production"
      ]) and contains_any?(lower, ["saldo", "wallet", "topup", "top up"]) ->
        "Saldo live adalah dana real. Pastikan metode bayar valid, data akun terverifikasi, dan jangan kirim pembayaran di luar checkout resmi platform. Kirim reference pembayaran jika ada kendala."

      contains_any?(lower, [
        "midtrans",
        "stripe",
        "xendit",
        "paypal",
        "adyen",
        "bca",
        "mandiri",
        "bni",
        "bri",
        "gopay",
        "shopeepay",
        "provider",
        "metode bayar",
        "qris",
        "va",
        "virtual account"
      ]) ->
        "Metode populer yang tersedia: GoPay, QRIS, ShopeePay, BCA VA, Mandiri VA, BNI VA, BRI VA, kartu, dan lainnya (tergantung provider). Untuk troubleshooting, kirim provider + metode + external reference/order id + nominal + jam transaksi agar saya bantu tracing cepat."

      contains_any?(lower, [
        "bayar",
        "pembayaran",
        "payment",
        "refund",
        "dana",
        "tagihan",
        "billing"
      ]) ->
        "Untuk pembayaran/refund: mohon kirim ID transaksi, nominal, metode bayar, dan waktu kejadian. Saya bantu cek status dan lanjutkan ke tim terkait bila perlu."

      contains_any?(lower, [
        "transaksi",
        "order",
        "pesanan",
        "buyer",
        "seller",
        "escrow",
        "dispute",
        "sengketa"
      ]) ->
        "Untuk isu transaksi, kirim kronologi singkat + ID transaksi + bukti pendukung. Saya akan bantu petakan langkah berikutnya agar prosesnya jelas."

      contains_any?(lower, ["scam", "penipuan", "otp", "pin", "phishing", "hack", "dibajak"]) ->
        "Terima kasih sudah lapor. Jangan bagikan OTP/PIN, jangan lanjut pembayaran di luar platform, dan ubah password sekarang. Jika ada transaksi mencurigakan, kirim detailnya agar segera kami tindak."

      contains_any?(lower, ["error", "bug", "gagal", "crash", "blank", "lemot"]) ->
        "Untuk masalah teknis, coba refresh, logout-login, dan update aplikasi/browser. Kalau masih error, kirim screenshot, device, browser, serta jam kejadian."

      contains_any?(lower, [
        "flow",
        "alur",
        "aturan",
        "policy",
        "sop",
        "proses"
      ]) ->
        "Flow bisnis yang direkomendasikan: 1) listing/offer, 2) transaksi, 3) pembayaran via wallet/provider resmi, 4) escrow/protection, 5) delivery, 6) review & settlement. Saya bisa jelaskan detail per tahap jika kamu sebut tahap yang lagi macet."

      true ->
        "Aida aktif 24/7. Saya sudah terima pesanmu: \"" <>
          excerpt(text) <>
          "\". Boleh tambah detail seperti ID transaksi/akun dan kronologi supaya saya bantu lebih tepat."
    end
  end

  defp greeting?(lower_text) do
    contains_any?(lower_text, [
      "hai",
      "halo",
      "hello",
      "hi",
      "selamat pagi",
      "selamat siang",
      "selamat sore",
      "selamat malam"
    ])
  end

  defp contains_any?(text, terms) when is_binary(text) and is_list(terms) do
    Enum.any?(terms, fn term ->
      String.contains?(text, term)
    end)
  end

  defp excerpt(text) do
    text
    |> String.replace(~r/\s+/, " ")
    |> String.slice(0, 180)
  end
end
