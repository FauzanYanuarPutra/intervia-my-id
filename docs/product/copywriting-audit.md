# Lajukan Frontend Copywriting Audit

Tanggal audit: 2026-07-11

## Ringkasan

Frontend `www` sudah mendukung locale `id` dan `en` melalui `next-intl`, tetapi cakupan i18n belum merata. File locale yang ada sudah seimbang antara Indonesia dan Inggris, sementara banyak halaman besar masih memakai teks langsung di komponen atau pola manual seperti `isId ? '...' : '...'`.

Pekerjaan tahap ini membuat fondasi audit, style guide, dan memperbaiki copy prioritas yang paling terlihat:

- Homepage locale dibuat lebih tenang, jelas, dan sesuai positioning kebutuhan usaha.
- Login/register dibuat konsisten memakai `kamu`, bukan `Anda`.
- Flow umum dirapikan dari campuran `user`, `listing`, `publish`, `quick create`, dan `activity hub`.
- State global `not found` dan `error` dibuat lebih natural serta bilingual.
- Script audit ditambahkan agar key locale dan kandidat hardcoded text bisa dicek berulang.

## Struktur i18n yang ditemukan

Framework:

- Next.js App Router
- `next-intl`
- Locale aktif: `id`, `en`
- Default locale: `id`

Locale bundle yang ditemukan:

- `about`
- `common`
- `forum`
- `home`
- `industries`
- `login`
- `register`

Loader utama:

- `frontend/www/src/i18n/loadMessages.ts`
- `frontend/www/src/i18n/routing.ts`
- `frontend/www/src/i18n/request.ts`

## Hasil Audit Otomatis

Perintah:

```bash
npm run i18n:audit
```

Hasil setelah perbaikan tahap ini:

| Area | Hasil |
| --- | ---: |
| Locale namespace | 7 |
| Key `id`/`en` tidak seimbang | 0 |
| Missing locale bundle | 0 |
| Kandidat JSX hardcoded text | 757 |
| Kandidat hardcoded attribute text | 282 |
| Kandidat manual locale branch | 4.776 |

Catatan: angka hardcoded adalah kandidat, bukan semuanya pasti masalah. Sebagian adalah label teknis kecil, placeholder internal, atau pola bilingual manual yang masih berfungsi tetapi belum ideal untuk perawatan jangka panjang.

## Temuan Penting

### Fakta

- Struktur key locale `id` dan `en` saat ini seimbang untuk namespace yang ada.
- Banyak fitur besar belum punya namespace locale sendiri, terutama search, create, chat, profile, reels, dan UMKM.
- Banyak komponen memakai pola `isId ? teksId : teksEn`, sehingga teks sudah bilingual tetapi belum tersentralisasi.
- Beberapa copy lama memakai nada terlalu agresif atau overclaim, misalnya FOMO, global claim, atau keamanan yang terdengar dijamin.

### Interpretasi

- Masalah utama bukan hanya terjemahan, tetapi governance copy: istilah, tone, dan cara menambah teks baru belum punya pagar.
- Migrasi semua teks ke locale dalam satu perubahan besar berisiko tinggi karena file UI besar sedang aktif berubah.
- Pendekatan aman adalah memulai dari namespace baru per fitur, lalu memindahkan copy halaman prioritas secara bertahap.

### Rekomendasi

- Pertahankan `id/en` sebagai dua bahasa utama.
- Tambahkan namespace locale berikutnya berdasarkan prioritas: `search`, `create`, `chat`, `profile`, `reels`, `umkm`.
- Gunakan `npm run i18n:audit` sebelum merge perubahan UI besar.
- Hindari menambah pola baru `isId ? ... : ...` untuk teks besar. Pakai locale key.

## Keputusan Copywriting

- Gunakan `kamu`, bukan `Anda`, untuk komunikasi langsung.
- Gunakan `postingan`, bukan `listing`, di UI Indonesia.
- Gunakan `tayangkan` / `sudah tayang`, bukan `publish` / `published`, di UI Indonesia.
- Gunakan `bantuan`, bukan `support`, kecuali nama teknis yang memang belum diterjemahkan.
- Gunakan `dompet`, bukan `wallet`, di UI Indonesia.
- Gunakan `pesanan`, bukan `order`, di UI Indonesia.
- Hindari klaim seperti `terjamin`, `pasti`, `termurah`, atau `semua terpercaya`.
- Untuk Lajukan, copy harus menekankan `cari`, `hubungi`, `tawarkan`, `pasang kebutuhan`, dan `sepakati langsung`, bukan menjanjikan hasil.

## Area yang Sudah Diperbaiki

| Area | Perubahan |
| --- | --- |
| Homepage locale | Hero, visual, activity card, social proof, properti, dashboard ready |
| Login locale | Title, subtitle, CTA, error, banner |
| Register locale | Title, subtitle, success, CTA, banner |
| Common Flow | Istilah `listing`, `publish`, `quick create`, `activity hub`, `support` dirapikan |
| Payment copy | `order`, `wallet`, `cash`, `pending` diganti ke istilah Indonesia |
| Global not found | Bilingual berdasarkan path locale |
| Global error | Copy error dibuat lebih singkat dan ramah |

## Prioritas Lanjutan

| Prioritas | Area | Alasan |
| --- | --- | --- |
| P0 | Search | Jalur utama pencarian kebutuhan usaha |
| P0 | Create | Banyak form, label, helper, error, dan CTA |
| P0 | Chat | Banyak hardcoded text dan aria-label |
| P1 | Profile | Banyak CTA, state, dan trust copy |
| P1 | UMKM discovery | Banyak label lokasi, keamanan, dan kontak |
| P1 | Reels/Video | Perlu konsistensi istilah `Video`, bukan campuran |
| P2 | Community | Banyak state diskusi, komentar, dan laporan |
| P2 | Settings | Banyak copy keamanan dan privasi |

## Cara Validasi

Gunakan:

```bash
cd frontend/www
npm run i18n:audit
npx eslint -- src/app/not-found.tsx src/app/error.tsx
```

Untuk validasi UI luas, gunakan smoke test Playwright yang sudah ada:

```bash
npx playwright test tests/e2e/lajukan-stabilization.spec.ts --project=chromium
```
