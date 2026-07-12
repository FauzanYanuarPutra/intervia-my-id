defmodule ChatService.AidaBot do
  @moduledoc false
  require Logger

  @support_room_id "support:aida"
  @bot_id "2b173810-4517-49cd-899f-a1da00000001"
  @bot_name "Aida Support"
  @bot_avatar "https://ui-avatars.com/api/?name=Aida+Support&background=0f766e&color=ffffff&size=128"
  @default_ollama_model "llama3.2:3b"
  @default_ollama_url "http://localhost:11434"
  @ollama_timeout_ms 8_000
  @max_user_text 1_200
  @max_reply_text 1_800

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
    attachments = opts |> Keyword.get(:attachments, [])
    message_type = opts |> Keyword.get(:message_type, "text") |> to_string() |> String.downcase()

    if ollama_enabled?() do
      case build_ollama_reply(text, opts, message_type, attachments) do
        {:ok, reply} ->
          reply

        {:error, reason} ->
          Logger.warning("Aida Ollama fallback: #{inspect(reason)}")
          build_rule_reply(text, message_type, attachments)
      end
    else
      build_rule_reply(text, message_type, attachments)
    end
  end

  defp build_rule_reply(text, message_type, attachments) do
    lower = String.downcase(text)

    cond do
      text == "" and is_list(attachments) and attachments != [] ->
        "Saya Aida Support Lajukan. File/media sudah masuk, tapi saya belum bisa membaca detailnya dari chat support ini. Tolong tulis ringkasan kendalanya, ID transaksi/listing bila ada, dan target bantuan yang kamu mau."

      text == "" and message_type in ["image", "video", "audio", "file", "sticker"] ->
        "Saya Aida Support Lajukan. Media sudah masuk. Tambahkan kronologi singkat, akun/fitur yang bermasalah, dan ID terkait kalau ada supaya saya bisa arahkan langkahnya."

      greeting?(lower) ->
        "Halo, saya Aida Support Lajukan. Sebutkan kendalanya ya: akun/login, transaksi, UMKM/listing, chat, pembayaran, komunitas, atau AI Studio. Sertakan ID transaksi/listing dan kronologi singkat kalau ada."

      contains_any?(lower, ["login", "masuk", "otp", "password", "akun", "verifikasi"]) ->
        "Untuk kendala login/akun Lajukan: cek email/nomor, tunggu OTP 1-2 menit, lalu coba kirim ulang atau gunakan lupa password. Jangan kirim OTP/password ke siapa pun. Kalau masih gagal, kirim email/nomor tersamarkan dan jam kejadian."

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
        "Saya Aida Support Lajukan. Saya sudah terima pesanmu: \"" <>
          excerpt(text) <>
          "\". Biar saya bisa bantu tepat, tambahkan fitur yang bermasalah, ID transaksi/listing/ticket bila ada, dan kronologi singkat."
    end
  end

  defp build_ollama_reply(text, opts, message_type, attachments) do
    payload =
      Jason.encode!(%{
        model: ollama_model(),
        stream: false,
        keep_alive: ollama_keep_alive(),
        messages: [
          %{role: "system", content: system_prompt()},
          %{role: "user", content: user_prompt(text, opts, message_type, attachments)}
        ],
        options: %{
          temperature: 0.35,
          top_p: 0.9,
          num_predict: 360
        }
      })

    url = ollama_url() <> "/api/chat"
    headers = [{~c"content-type", ~c"application/json"}, {~c"accept", ~c"application/json"}]

    case :httpc.request(
           :post,
           {String.to_charlist(url), headers, ~c"application/json", payload},
           [timeout: ollama_timeout_ms(), connect_timeout: ollama_timeout_ms()],
           body_format: :binary
         ) do
      {:ok, {{_, status, _}, _headers, body}} when status in 200..299 ->
        parse_ollama_body(body)

      {:ok, {{_, status, _}, _headers, body}} ->
        {:error, {:ollama_status, status, byte_size(to_string(body))}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp parse_ollama_body(body) do
    with {:ok, %{"message" => %{"content" => content}}} <- Jason.decode(body),
         reply when reply != "" <- clean_reply(content) do
      {:ok, reply}
    else
      _ -> {:error, :invalid_ollama_response}
    end
  end

  defp system_prompt do
    """
    Kamu adalah Aida Support, agent bantuan resmi Lajukan.

    Konteks produk:
    - Lajukan membantu kebutuhan bisnis Indonesia: pencarian penyedia, UMKM/storefront, listing, map, chat, transaksi, wallet/pembayaran, komunitas, reels, support, CRM internal, dan AI Studio.
    - Chat support adalah kanal privat untuk membantu pengguna dan mengarahkan eskalasi ke tim manusia bila perlu.

    Aturan jawaban:
    - Jawab dalam Bahasa Indonesia yang ramah, jelas, dan singkat.
    - Triage masalah: akun/login, transaksi/order, wallet/top up/refund, UMKM/listing/search/map, chat/WhatsApp, komunitas/reels, keamanan/penipuan, bug teknis, atau AI Studio.
    - Minta data yang relevan saja: ID transaksi/order/listing/ticket, fitur yang dipakai, browser/device, jam kejadian, screenshot/bukti bila perlu.
    - Jangan pernah meminta password, OTP, PIN, token, private key, atau data kartu penuh.
    - Jangan mengaku sudah mengecek database, mengubah status, refund, atau menyelesaikan transaksi kalau data tidak tersedia di pesan.
    - Untuk penipuan/akun dibajak/pembayaran di luar platform: beri langkah aman segera dan arahkan eskalasi prioritas.
    - Untuk issue teknis: berikan langkah cepat dan data debugging yang perlu dikirim.
    - Jika pesan hanya sapaan, arahkan pengguna memilih topik bantuan Lajukan, bukan balasan generik.
    - Hindari markdown berlebihan. Maksimal 4 poin pendek.
    """
    |> String.trim()
  end

  defp user_prompt(text, opts, message_type, attachments) do
    room_id = opts |> Keyword.get(:room_id, "") |> to_string() |> String.slice(0, 160)

    attachment_summary =
      attachments
      |> attachment_count()
      |> case do
        0 -> "tidak ada"
        count -> "#{count} item; jangan sebut URL/file privat, cukup minta konteks bila perlu"
      end

    """
    Room support: #{room_id}
    Tipe pesan: #{message_type}
    Lampiran: #{attachment_summary}
    Pesan pengguna:
    #{text |> normalize_user_text() |> String.slice(0, @max_user_text)}

    Buat balasan Aida Support yang langsung membantu untuk konteks Lajukan.
    """
    |> String.trim()
  end

  defp clean_reply(content) do
    content
    |> to_string()
    |> String.replace(~r/<think>.*?<\/think>/s, "")
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
    |> String.slice(0, @max_reply_text)
  end

  defp normalize_user_text(""), do: "(pesan kosong)"

  defp normalize_user_text(text) do
    text
    |> to_string()
    |> String.replace(~r/\s+/, " ")
    |> String.trim()
  end

  defp attachment_count(list) when is_list(list), do: length(list)
  defp attachment_count(nil), do: 0
  defp attachment_count(_), do: 1

  defp ollama_enabled? do
    truthy?(System.get_env("SUPPORT_AI_USE_OLLAMA")) or truthy?(System.get_env("USE_OLLAMA"))
  end

  defp ollama_url do
    (System.get_env("CHAT_OLLAMA_URL") || System.get_env("OLLAMA_URL") || @default_ollama_url)
    |> to_string()
    |> String.trim()
    |> String.trim_trailing("/")
  end

  defp ollama_model do
    (env_text("OLLAMA_SUPPORT_MODEL") ||
       env_text("OLLAMA_BUSINESS_MODEL") ||
       env_text("OLLAMA_MODEL") ||
       @default_ollama_model)
    |> to_string()
    |> String.trim()
    |> case do
      "" -> @default_ollama_model
      model -> model
    end
  end

  defp env_text(name) do
    case System.get_env(name) do
      value when is_binary(value) ->
        value = String.trim(value)
        if value == "", do: nil, else: value

      _ ->
        nil
    end
  end

  defp ollama_keep_alive do
    value = System.get_env("OLLAMA_KEEP_ALIVE") || "10m"
    if Regex.match?(~r/^\d+(ms|s|m|h)$/i, value), do: value, else: "10m"
  end

  defp ollama_timeout_ms do
    case Integer.parse(System.get_env("OLLAMA_SUPPORT_TIMEOUT_MS") || "") do
      {value, ""} when value >= 1_000 and value <= 45_000 -> value
      _ -> @ollama_timeout_ms
    end
  end

  defp truthy?(value) when is_binary(value) do
    normalized = value |> String.trim() |> String.downcase()
    normalized in ["1", "true", "yes", "on"]
  end

  defp truthy?(_), do: false

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
