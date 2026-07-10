# AI Matching Architecture

Status: repo-grounded architecture direction 2026-07-11.

## Nama Produk

Nama fitur: `Lajukan Match`.

Tujuan: membantu tim Lajukan memahami kebutuhan pengguna dan memilih penyedia yang paling relevan dari data Lajukan, dengan kontrol admin dan audit yang jelas.

## Prinsip

1. AI tidak boleh mengarang penyedia.
   Semua kandidat harus berasal dari database/index Lajukan.

2. AI tidak boleh menimpa input asli.
   Simpan original text/media context, extraction, correction, model version, prompt version, dan scoring version secara terpisah.

3. Review admin dulu.
   MVP tidak auto-connect.

4. Retrieval ringan dulu.
   Gunakan Postgres dan Meilisearch lebih dulu. Qdrant/vector search boleh ditambah setelah ada bukti keyword/hybrid tidak cukup.

5. Scoring harus versioned.
   Weight dan formula harus bisa diaudit agar perubahan ranking bisa dijelaskan.

## Pipeline

```text
Kebutuhan masuk
  -> Validasi dan normalisasi
  -> Ekstraksi AI/aturan
  -> Hard filter
  -> Retrieval kandidat
  -> Scoring
  -> Reranking
  -> Explainability
  -> Admin review
  -> Connection
  -> Feedback/outcome
  -> Learning signal
```

## Input

Sumber kebutuhan:

- create flow dengan `pricing_mode = request`;
- search assist yang eksplisit menjadi kebutuhan;
- chat/manual admin;
- support ticket;
- import admin;
- future WhatsApp intake.

Input yang disimpan:

| Field | Keterangan |
| --- | --- |
| `source_entity_type` | `content_item`, `chat`, `support_ticket`, `manual` |
| `source_entity_id` | ID sumber |
| `original_text` | Teks asli |
| `original_metadata` | Metadata sumber |
| `media_refs` | Referensi foto/file, bukan raw binary |
| `requester_user_id` | Opsional |
| `created_by` | user/admin/system |

## Ekstraksi

Extraction schema awal:

| Field | Type | Contoh |
| --- | --- | --- |
| `need_type` | enum | equipment, supplies, service, place, opportunity, local_business |
| `business_context` | text | usaha minuman cup |
| `required_items` | array | cup sealer, cup 16 oz, bubuk thai tea |
| `category` | text | Mesin & Alat |
| `sub_category` | text | Sealer minuman |
| `location_text` | text | Bandung |
| `city` | text | Bandung |
| `latitude`, `longitude` | number | jika ada |
| `budget_min`, `budget_max` | number | rupiah |
| `deadline` | date/text | minggu depan |
| `quantity` | text/number | 1 unit, 100 pcs |
| `must_have` | array | garansi, instalasi |
| `nice_to_have` | array | training operator |
| `risk_flags` | array | too_vague, suspicious_dp, unclear_location |
| `missing_fields` | array | budget, location |
| `confidence` | number | 0-1 |

Aturan:

- Jika confidence rendah, status `needs_admin_review`.
- Jika field wajib kosong, jangan buat connection.
- Admin correction disimpan sebagai record baru atau patch audit, bukan overwrite original extraction.

## Hard Filter

Filter keras sebelum scoring:

- listing/status aktif;
- kategori cocok atau masih satu rumpun;
- market side cocok: kebutuhan pencari harus dicocokkan ke supply/provider;
- lokasi tersedia bila requirement memerlukan area tertentu;
- penyedia tidak banned/restricted;
- listing tidak hidden/rejected;
- produk/jasa tidak ilegal atau melanggar policy;
- stok/availability tidak jelas diberi penalty atau warning.

## Retrieval

Urutan MVP:

1. Postgres query terhadap `content_items`, UMKM store/product, metadata category, city, tags, title, summary.
2. Meilisearch keyword/hybrid bila index tersedia.
3. Optional: vector search/Qdrant setelah ada data training dan evaluasi.

Candidate pool:

- Ambil 100 kandidat awal maksimum.
- Normalisasi jadi format kandidat tunggal.
- Deduplicate berdasarkan listing/store/business owner.
- Jangan tampilkan lebih dari 1-2 kandidat dari penyedia yang sama kecuali sangat relevan.

## Scoring V1

Skor maksimal 100.

| Komponen | Bobot Awal | Catatan |
| --- | ---: | --- |
| Keyword/category fit | 25 | Judul, kategori, tag, metadata |
| Need-item fit | 20 | Cocok dengan item yang dibutuhkan |
| Location fit | 15 | Kota/radius/ongkir/lokasi |
| Price/budget fit | 10 | Harga dalam range, MOQ masuk akal |
| Trust/verification | 10 | WA aktif, listing lengkap, badge |
| Availability/response | 10 | Stok/siap/respons cepat bila data ada |
| Listing quality | 5 | Foto, deskripsi, spesifikasi |
| Risk penalty | -15 sampai 0 | Flag fraud, tidak jelas, terlalu murah |
| Freshness | 5 | Baru/aktif diperbarui |

Formula harus disimpan dengan `scoring_version`, misalnya `lajukan-match-score-v1`.

## Reranking

Tahap:

1. Kandidat 100 dari retrieval.
2. Score deterministic.
3. Ambil 20 kandidat terbaik.
4. Optional LLM rerank hanya untuk menjelaskan dan memilih 3-5 terbaik.
5. Jika LLM timeout, tetap pakai scoring deterministic.

LLM tidak boleh menambahkan kandidat baru.

## Explainability

Setiap kandidat harus punya:

- `score_total`;
- `score_breakdown`;
- `matched_fields`;
- `missing_fields`;
- `reasons`;
- `warnings`;
- `verification_snapshot`;
- `distance_snapshot` bila lokasi cukup;
- `data_quality_notes`.

Contoh alasan:

- Cocok karena listing menyebut `cup sealer`, kategori `Mesin & Alat`, dan lokasi Bandung.
- Warning: harga tidak tersedia, admin perlu minta konfirmasi.
- Warning: lokasi hanya kota, jarak tidak bisa dihitung presisi.

## Feedback Loop

Learning signal yang disimpan:

| Signal | Sumber |
| --- | --- |
| admin approved candidate | AI Matching page |
| admin rejected candidate | AI Matching page |
| reject reason | admin |
| seeker contacted provider | chat/WhatsApp click |
| provider responded | chat/status |
| connection succeeded/failed | admin/outcome |
| reason failed | admin/user |
| user correction to extraction | admin/user |

Ini bukan fine-tuning otomatis. Tahap awal learning berarti memperbaiki scoring weight, synonyms, category mapping, prompt, dan validation rules.

## Security And Privacy

- AI service/API tidak boleh menerima database credentials langsung dari client.
- Hanya server-side route yang boleh memanggil model/provider.
- Mask phone/email di log.
- Jangan kirim raw token/env ke AI.
- Batasi payload image/text size.
- Simpan media refs, bukan raw binary di matching table.
- Semua admin action harus punya `actor_user_id`, timestamp, IP/user-agent bila tersedia, dan reason.
- LLM output harus schema-validated sebelum masuk DB.

## Failure Modes

| Failure | Response |
| --- | --- |
| AI extraction timeout | Fallback rule extraction, status `needs_admin_review` |
| Meilisearch down | Fallback Postgres query |
| Tidak ada kandidat | Status `no_match`, tampilkan missing supply/category/location |
| Candidate low confidence | Jangan auto-connect, tampilkan warning |
| Duplicate event | Idempotency key mencegah duplicate run/connection |
| Bad LLM JSON | Reject output, simpan provider error ringkas internal-only |

## Observability

Metrics:

- extraction latency;
- retrieval latency;
- scoring latency;
- match run success/failure;
- candidate count distribution;
- admin approve rate;
- connection contact rate;
- provider response rate;
- success/failure outcome rate;
- no-match by category/city;
- top missing data fields.

Logs harus internal dan tidak memuat secrets.

## MVP API Shape

Internal backend routes dapat dimulai di marketplace service:

```text
GET    /v1/crm/requirements
GET    /v1/crm/requirements/{id}
POST   /v1/crm/requirements/{id}/extract
POST   /v1/crm/requirements/{id}/match
GET    /v1/crm/match-runs/{id}
PATCH  /v1/crm/match-candidates/{id}
POST   /v1/crm/connections
PATCH  /v1/crm/connections/{id}
POST   /v1/crm/matching-feedback
```

WWW/CRM frontend should call these through BFF/proxy routes when needed.

## Do Not Build Yet

- Full self-learning fine-tune pipeline.
- Autonomous WhatsApp outreach.
- Qdrant mandatory dependency.
- Seller-facing AI sales assistant.
- Public claim that AI guarantees success.
