# WhatsApp Meta Production Setup

Dokumen ini untuk menghubungkan Lajukan dengan WhatsApp Cloud API milik Meta.

## Callback Webhook

Gunakan endpoint berikut di dashboard Meta:

```text
https://www.lajukan.com/api/webhooks/whatsapp-meta
```

Untuk lokal, pakai tunnel publik seperti Cloudflare Tunnel atau ngrok:

```text
https://your-tunnel.example.com/api/webhooks/whatsapp-meta
```

## Verify Token

Isi `Verifikasi token` di Meta dengan nilai yang sama seperti env:

```env
WHATSAPP_META_WEBHOOK_VERIFY_TOKEN=lajukan_verify_22012005
```

Token ini bebas dibuat sendiri. Gunakan string acak yang panjang dan jangan commit nilai asli.

## Env Minimal

Untuk test number Meta, mode text masih bisa dipakai selama penerima masuk allowlist dan/atau ada sesi layanan pelanggan 24 jam.

```env
WHATSAPP_META_ACCESS_TOKEN=replace_with_meta_whatsapp_access_token
WHATSAPP_META_PHONE_NUMBER_ID=replace_with_meta_phone_number_id
WHATSAPP_META_API_VERSION=v22.0
WHATSAPP_META_DEFAULT_COUNTRY_CODE=62
WHATSAPP_META_OTP_MODE=text
WHATSAPP_META_WEBHOOK_VERIFY_TOKEN=lajukan_verify_22012005
WHATSAPP_META_APP_SECRET=replace_with_meta_app_secret
WHATSAPP_META_WEBHOOK_REQUIRE_SIGNATURE=false
```

Untuk production OTP, gunakan template authentication yang sudah approved:

```env
WHATSAPP_META_ACCESS_TOKEN=replace_with_permanent_meta_whatsapp_access_token
WHATSAPP_META_PHONE_NUMBER_ID=replace_with_registered_phone_number_id
WHATSAPP_META_API_VERSION=v22.0
WHATSAPP_META_DEFAULT_COUNTRY_CODE=62
WHATSAPP_META_OTP_MODE=template
WHATSAPP_META_OTP_TEMPLATE_NAME=replace_with_approved_otp_template
WHATSAPP_META_OTP_TEMPLATE_LANGUAGE=id
WHATSAPP_META_OTP_TEMPLATE_BUTTON_SUB_TYPE=
WHATSAPP_META_OTP_TEMPLATE_BUTTON_INDEX=0
WHATSAPP_META_WEBHOOK_VERIFY_TOKEN=lajukan_verify_22012005
WHATSAPP_META_APP_SECRET=replace_with_meta_app_secret
WHATSAPP_META_WEBHOOK_REQUIRE_SIGNATURE=true
```

## Subscriptions Di Meta

Setelah callback terverifikasi, subscribe minimal ke field:

```text
messages
```

Field ini menerima pesan masuk dan status delivery. Endpoint Lajukan saat ini menyimpan audit ringkas ke Redis dengan key:

```text
webhook:whatsapp-meta:audit
```

Audit sengaja tidak menyimpan isi pesan mentah penuh supaya lebih aman untuk data pengguna.

## Catatan Keamanan

Jika access token pernah terlihat di chat, screenshot, commit, atau log, anggap token sudah bocor dan rotate token sebelum production.

Di production, isi `WHATSAPP_META_APP_SECRET` dan biarkan `WHATSAPP_META_WEBHOOK_REQUIRE_SIGNATURE=true` supaya request POST webhook diverifikasi dari header `x-hub-signature-256`.
