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

Buat verify token acak yang panjang, simpan hanya di secret/environment runtime, lalu isi `Verifikasi token` di Meta dengan nilai yang sama.

```env
WHATSAPP_META_WEBHOOK_VERIFY_TOKEN=replace-with-random-webhook-verify-token
```

`WHATSAPP_META_WEBHOOK_VERIFY_TOKEN` wajib dikonfigurasi untuk proses verifikasi callback. Endpoint Lajukan fail-closed: bila variabel ini kosong atau token tidak cocok, request verifikasi ditolak dengan HTTP 403.

Jangan commit nilai asli. Nilai verify token yang pernah muncul di commit, log, screenshot, chat, atau dokumentasi publik harus dianggap tidak layak digunakan kembali dan diganti sebelum deployment.

## Env Minimal

Untuk test number Meta, mode text masih bisa dipakai selama penerima masuk allowlist dan/atau ada sesi layanan pelanggan 24 jam.

```env
WHATSAPP_META_ACCESS_TOKEN=replace-with-meta-whatsapp-access-token
WHATSAPP_META_PHONE_NUMBER_ID=replace-with-meta-phone-number-id
WHATSAPP_META_API_VERSION=v22.0
WHATSAPP_META_DEFAULT_COUNTRY_CODE=62
WHATSAPP_META_OTP_MODE=text
WHATSAPP_META_WEBHOOK_VERIFY_TOKEN=replace-with-random-webhook-verify-token
WHATSAPP_META_APP_SECRET=replace-with-meta-app-secret
WHATSAPP_META_WEBHOOK_REQUIRE_SIGNATURE=false
```

Untuk production OTP, gunakan template authentication yang sudah approved:

```env
WHATSAPP_META_ACCESS_TOKEN=replace-with-permanent-meta-whatsapp-access-token
WHATSAPP_META_PHONE_NUMBER_ID=replace-with-registered-phone-number-id
WHATSAPP_META_API_VERSION=v22.0
WHATSAPP_META_DEFAULT_COUNTRY_CODE=62
WHATSAPP_META_OTP_MODE=template
WHATSAPP_META_OTP_TEMPLATE_NAME=replace-with-approved-otp-template
WHATSAPP_META_OTP_TEMPLATE_LANGUAGE=id
WHATSAPP_META_OTP_TEMPLATE_BUTTON_SUB_TYPE=
WHATSAPP_META_OTP_TEMPLATE_BUTTON_INDEX=0
WHATSAPP_META_WEBHOOK_VERIFY_TOKEN=replace-with-random-production-verify-token
WHATSAPP_META_APP_SECRET=replace-with-meta-app-secret
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

Jika access token, app secret, verify token, atau credential lain pernah terlihat di chat, screenshot, commit, atau log, anggap nilai tersebut sudah terekspos dan rotate sebelum production.

Di production, isi `WHATSAPP_META_APP_SECRET` dan gunakan `WHATSAPP_META_WEBHOOK_REQUIRE_SIGNATURE=true` supaya request POST webhook diverifikasi dari header `x-hub-signature-256`.

Sebelum deploy perubahan webhook:

1. buat verify token baru yang tidak pernah dipublikasikan;
2. simpan token dan app secret pada environment/secret store production;
3. samakan verify token di dashboard Meta;
4. pastikan callback GET terverifikasi;
5. kirim test webhook dan pastikan signature POST diterima;
6. jangan masukkan credential runtime ke file `.env.*.example`.
