# CRM Product Spec

Status: repo-grounded product direction 2026-07-11.

## Ringkasan

CRM Lajukan tahap berikutnya adalah pusat operasional internal untuk membantu tim Lajukan mengelola kebutuhan pengguna, menemukan penyedia yang cocok, meninjau hasil AI, menghubungkan kedua pihak, lalu mencatat hasilnya.

Alur produk:

```text
Pencari
  -> Kebutuhan
  -> Penyedia sesuai
  -> Terhubung
  -> Berhasil / Gagal
```

Ini bukan CRM penjual tradisional. Jangan memulai dari pipeline `lead -> quotation -> sales` untuk pemilik toko. Owner/seller CRM bisa menjadi mode berikutnya setelah internal matching CRM stabil.

## Fakta Repo Saat Ini

| Area | Status Saat Ini | Bukti |
| --- | --- | --- |
| CRM app | Sudah ada command center internal | `frontend/crm/src/components/crm/CrmCommandCenter.tsx` |
| CRM API | Sudah ada lead/activity API | marketplace `/v1/crm/leads`, `/v1/crm/activities`; WWW `/api/crm/*` |
| CRM schema | Baru `crm_leads` dan `crm_activities` | `20260224120000_crm_leads.up.sql` |
| Kebutuhan/request | Sudah ada sebagai content request | `content_items` dengan `pricing_mode = 'request'`, `/v1/lajukan/requests` |
| Listing/provider | Sudah ada content/listing/UMKM store primitives | marketplace content, UMKM store/product routes |
| Support/moderasi | Sudah ada support ticket dan moderation flow | support ticket migrations/API dan CRM listing moderation UI |
| Event foundation | Sudah ada event log/API | `/api/events`, marketplace `/v1/events` |

## Keputusan Produk

1. CRM internal dulu.
   Fokus pada operasi Lajukan: kebutuhan, listing, matching, koneksi, feedback, moderasi, laporan, support.

2. Pengguna tidak dikunci sebagai buyer/seller.
   Satu user bisa mencari barang hari ini dan menjadi penyedia besok. Gunakan perilaku dan entity, bukan tipe akun kaku.

3. Kebutuhan adalah objek utama.
   Pengguna datang karena punya kebutuhan nyata: mesin, bahan, jasa, tempat, peluang, usaha sekitar, atau bantuan mencari supplier.

4. Lajukan Match adalah inti.
   AI membantu memahami kebutuhan, mencari kandidat, memberi skor, menjelaskan alasan, dan meminta review admin.

5. Admin review sebelum koneksi.
   Tahap awal tidak boleh auto-connect. AI merekomendasikan; admin atau sistem rule yang diaudit menentukan kapan pengguna dihubungkan.

6. Analytics bukan CRM lead.
   Search, view, click, map view, dan impression masuk analytics. CRM hanya menangani kebutuhan/koneksi/feedback yang jelas.

## Non-Goals Tahap Ini

- CRM penjualan milik supplier.
- Quotation/invoice lengkap untuk pemilik toko.
- Automation builder.
- AI yang otomatis mengirim WhatsApp.
- Vector database wajib dari awal.
- Service split ke `crm_service` sebelum domain stabil.

## Navigasi CRM Internal

| Menu | Tujuan |
| --- | --- |
| Ringkasan | Tindakan hari ini, antrean kebutuhan, matching yang perlu review, koneksi bermasalah |
| Marketplace | Grup kerja untuk Kebutuhan, Listing, AI Matching, Hubungan |
| Pengguna | Profil pencari/penyedia, trust, histori kebutuhan, histori koneksi |
| Layanan | Support ticket, laporan listing, verifikasi, onboarding penyedia |
| Analitik | Demand, supply, zero result, match rate, contact rate, outcome rate |
| Pengaturan | Role, permission, scoring weights, prompt/model version, audit policy |

Sub-menu Marketplace:

| Submenu | Isi |
| --- | --- |
| Kebutuhan | Request pengguna yang perlu dipahami, diverifikasi, dan dicari penyedianya |
| Listing | Penyedia/listing aktif, pending, bermasalah, tidak lengkap, atau perlu verifikasi |
| AI Matching | Hasil `Lajukan Match`, kandidat, skor, alasan, warning, keputusan admin |
| Hubungan | Koneksi antara pencari dan penyedia serta hasil akhirnya |

## Halaman Kebutuhan

Field minimal:

| Field | Keterangan |
| --- | --- |
| `requirement_id` | Referensi kebutuhan. Bisa mulai dari `content_items.id` request |
| `requester_user_id` | User pencari bila login |
| `original_text` | Teks asli dari pengguna, tidak ditimpa AI |
| `category` | Mesin, bahan, jasa, tempat, peluang, usaha sekitar, lain-lain |
| `location_text` | Kota/area teks dari user |
| `latitude`, `longitude` | Opsional, hanya jika ada koordinat |
| `budget_min`, `budget_max` | Opsional |
| `deadline` | Opsional |
| `status` | `new`, `needs_review`, `ready_to_match`, `matching`, `connected`, `closed` |
| `source` | create form, search assist, chat, admin import, support |
| `risk_flags` | Spam, vague, illegal, suspicious, incomplete |

Aksi admin:

- Review kebutuhan.
- Koreksi hasil ekstraksi AI.
- Tandai perlu data tambahan.
- Jalankan matching.
- Pilih kandidat.
- Buat koneksi.
- Tutup sebagai berhasil/gagal/tidak valid.

## Halaman Listing

Field yang perlu terlihat:

| Field | Keterangan |
| --- | --- |
| `listing_id` | Content/listing/store/product reference |
| `owner_id` | Pemilik listing |
| `title` | Judul |
| `category`, `sub_category` | Kategori |
| `market_side` | supply/demand bila ada |
| `location_text`, `city`, `lat`, `lng` | Lokasi dan koordinat |
| `price`, `price_unit` | Harga bila ada |
| `minimum_order` | MOQ bila ada |
| `availability` | Stok/siap/jasa aktif |
| `verification_status` | Trust/verifikasi |
| `response_signal` | Chat/WA response proxy bila tersedia |
| `status` | active, pending, paused, rejected, hidden |

Aksi admin:

- Aktifkan / tahan / minta revisi.
- Tandai kategori.
- Tambahkan catatan verifikasi.
- Lihat kecocokan kebutuhan.
- Lihat laporan.

## Halaman AI Matching

Tujuan halaman ini adalah membuat kerja admin lebih cepat tanpa kehilangan kontrol.

Layout minimum:

1. Kebutuhan asli.
2. Ekstraksi AI.
3. Confidence dan field yang perlu review.
4. Kriteria pencarian.
5. Kandidat penyedia.
6. Skor total dan breakdown.
7. Alasan cocok.
8. Warning.
9. Status verifikasi dan kelengkapan data.
10. Aksi: approve, reject, ask more info, create connection.

Status matching:

| Status | Arti |
| --- | --- |
| `queued` | Menunggu proses |
| `extracted` | Kebutuhan sudah diekstrak |
| `retrieved` | Kandidat awal ditemukan |
| `scored` | Kandidat sudah diberi skor |
| `needs_admin_review` | Perlu review sebelum dikirim |
| `approved` | Kandidat disetujui admin |
| `connected` | Koneksi dibuat |
| `no_match` | Kandidat tidak cukup baik |
| `failed` | Proses error dan perlu ditinjau |

## Hubungan / Connection

Connection adalah entity antara pencari, kebutuhan, penyedia, dan listing/store.

Status:

| Status | Arti |
| --- | --- |
| `draft` | Disiapkan admin |
| `sent` | Rekomendasi dikirim |
| `opened` | Pencari/penyedia melihat |
| `contacted` | Ada klik WhatsApp/chat/call |
| `responded` | Penyedia merespons |
| `negotiating` | Komunikasi berlanjut |
| `succeeded` | Cocok/terjadi kesepakatan |
| `failed` | Tidak cocok |
| `spam_or_invalid` | Tidak valid |

Outcome wajib dicatat:

- berhasil;
- gagal karena harga;
- gagal karena lokasi;
- gagal karena stok;
- gagal karena tidak respons;
- gagal karena kebutuhan berubah;
- gagal karena kandidat tidak relevan;
- spam/tidak valid.

## Roles And Permissions

| Role | Akses |
| --- | --- |
| `super_admin` | Semua akses, scoring settings, audit export |
| `admin` | Review kebutuhan/listing/matching, koneksi |
| `ops` | Kebutuhan, matching, connection, support |
| `support` | Ticket, laporan, pengguna, connection read |
| `sales` | Onboarding penyedia, listing quality, verification |
| `viewer` | Read-only dashboard |

Semua perubahan AI extraction, scoring version, candidate decision, dan connection outcome harus masuk audit log.

## Reusable Parts

| Existing Part | Reuse For |
| --- | --- |
| `content_items` request | Kebutuhan awal |
| `/v1/lajukan/requests` | Antrean kebutuhan |
| content/listing APIs | Kandidat penyedia |
| `crm_leads` | Legacy CRM signal, tidak menjadi core matching baru |
| `crm_activities` | Bisa direuse sebagai timeline/audit sementara |
| support tickets | Report, dispute, bantuan koneksi |
| events/event_log | Demand analytics dan feedback |
| Meilisearch | Candidate retrieval |
| frontend CRM shell | Surface internal CRM |

## Yang Perlu Diperbaiki

1. Event-to-CRM lead.
   `crm_lead_signal_for_event` saat ini bisa membuat lead dari search/click/map signal. Untuk arah baru, passive intent harus analytics, bukan CRM lead.

2. CRM nav.
   `frontend/crm` perlu digeser dari `CRM Pipeline` menjadi `Marketplace -> Kebutuhan, Listing, AI Matching, Hubungan`.

3. Data model matching.
   Belum ada table untuk extraction, matching run, candidate score, connection, feedback, scoring version, dan audit log khusus.

4. API.
   Belum ada endpoint internal untuk run/review matching dan membuat connection.

5. Analytics.
   Perlu dashboard demand/supply/match outcome, bukan hanya pipeline/GMV.

## Acceptance Criteria V1

- Admin bisa melihat kebutuhan masuk dari request content.
- Admin bisa melihat listing/penyedia yang aktif dan kualitas datanya.
- Admin bisa menjalankan Lajukan Match untuk satu kebutuhan.
- Sistem menyimpan extraction AI tanpa menimpa input asli.
- Sistem memberi 3-5 kandidat dengan skor, breakdown, alasan, dan warning.
- Admin bisa approve/reject kandidat.
- Admin bisa membuat connection dan mencatat outcome.
- Passive search/click tidak otomatis menjadi CRM lead.
- Semua keputusan matching memiliki audit trail.
