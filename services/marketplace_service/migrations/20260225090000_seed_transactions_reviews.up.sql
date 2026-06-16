-- Seed transactions + reviews to generate real ratings/trust signals.
-- Ratings are derived from reviews, not hardcoded on listings.

WITH content_map AS (
  SELECT slug, id, owner_id, price_cents, currency
  FROM content_items
  WHERE slug IN (
    'smartphone-iphone-15-pro',
    'jasa-ui/ux-design',
    'full-stack-developer',
    'apartemen-di-sudirman'
  )
),
seed_tx AS (
  SELECT
    '10000000-0000-0000-0000-000000000001'::uuid AS id,
    'smartphone-iphone-15-pro' AS slug,
    '00000000-0000-0000-0000-000000000003'::uuid AS buyer_id,
    'completed'::text AS status,
    'Tertarik beli, bisa nego?' AS offer_message,
    'Deal, lanjutkan transaksi.' AS response_message,
    NOW() - INTERVAL '35 days' AS created_at
  UNION ALL
  SELECT
    '10000000-0000-0000-0000-000000000002'::uuid,
    'jasa-ui/ux-design',
    '00000000-0000-0000-0000-000000000002'::uuid,
    'completed'::text,
    'Butuh UI/UX untuk MVP.',
    'Siap bantu, kirim requirement ya.',
    NOW() - INTERVAL '25 days'
  UNION ALL
  SELECT
    '10000000-0000-0000-0000-000000000003'::uuid,
    'full-stack-developer',
    '00000000-0000-0000-0000-000000000003'::uuid,
    'completed'::text,
    'Apply untuk posisi ini.',
    'Terima kasih, lanjut interview.',
    NOW() - INTERVAL '18 days'
  UNION ALL
  SELECT
    '10000000-0000-0000-0000-000000000004'::uuid,
    'apartemen-di-sudirman',
    '00000000-0000-0000-0000-000000000002'::uuid,
    'completed'::text,
    'Tertarik survey unit.',
    'Bisa, jadwalkan visit.',
    NOW() - INTERVAL '12 days'
  UNION ALL
  SELECT
    '10000000-0000-0000-0000-000000000005'::uuid,
    'smartphone-iphone-15-pro',
    '00000000-0000-0000-0000-000000000004'::uuid,
    'cancelled'::text,
    'Harga bisa diturunkan?',
    'Mohon maaf belum sesuai.',
    NOW() - INTERVAL '8 days'
  UNION ALL
  SELECT
    '10000000-0000-0000-0000-000000000006'::uuid,
    'jasa-ui/ux-design',
    '00000000-0000-0000-0000-000000000005'::uuid,
    'accepted'::text,
    'Mulai minggu depan bisa?',
    'Bisa, tolong kirim brief.',
    NOW() - INTERVAL '6 days'
  UNION ALL
  SELECT
    '10000000-0000-0000-0000-000000000007'::uuid,
    'full-stack-developer',
    '00000000-0000-0000-0000-000000000002'::uuid,
    'cancelled'::text,
    'Apply untuk posisi ini.',
    'Posisi sudah terisi.',
    NOW() - INTERVAL '5 days'
  UNION ALL
  SELECT
    '10000000-0000-0000-0000-000000000008'::uuid,
    'apartemen-di-sudirman',
    '00000000-0000-0000-0000-000000000004'::uuid,
    'accepted'::text,
    'Saya tertarik sewa.',
    'Boleh, kita lanjutkan dokumen.',
    NOW() - INTERVAL '4 days'
),
inserted_tx AS (
  INSERT INTO transactions (
    id, content_id, buyer_id, seller_id, amount_cents, currency,
    transaction_status, offer_message, response_message, created_at, updated_at
  )
  SELECT
    tx.id,
    c.id,
    tx.buyer_id,
    c.owner_id,
    COALESCE(c.price_cents, 1000000),
    COALESCE(c.currency, 'IDR'),
    tx.status,
    tx.offer_message,
    tx.response_message,
    tx.created_at,
    tx.created_at + INTERVAL '1 day'
  FROM seed_tx tx
  JOIN content_map c ON c.slug = tx.slug
  ON CONFLICT (id) DO NOTHING
  RETURNING id, content_id, buyer_id, seller_id
),
seed_reviews AS (
  SELECT
    id,
    content_id,
    buyer_id,
    seller_id,
    CASE id
      WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 5
      WHEN '10000000-0000-0000-0000-000000000002'::uuid THEN 4
      WHEN '10000000-0000-0000-0000-000000000003'::uuid THEN 4
      WHEN '10000000-0000-0000-0000-000000000004'::uuid THEN 5
      ELSE 4
    END AS buyer_rating,
    CASE id
      WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 'Barang sesuai deskripsi, pengiriman cepat.'
      WHEN '10000000-0000-0000-0000-000000000002'::uuid THEN 'Hasil desain rapi dan komunikatif.'
      WHEN '10000000-0000-0000-0000-000000000003'::uuid THEN 'Proses rekrutmen cepat dan jelas.'
      WHEN '10000000-0000-0000-0000-000000000004'::uuid THEN 'Unit sesuai foto, jadwal survey fleksibel.'
      ELSE 'Pelayanan bagus.'
    END AS buyer_comment,
    CASE id
      WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 5
      WHEN '10000000-0000-0000-0000-000000000002'::uuid THEN 5
      WHEN '10000000-0000-0000-0000-000000000003'::uuid THEN 4
      WHEN '10000000-0000-0000-0000-000000000004'::uuid THEN 5
      ELSE 4
    END AS seller_rating,
    CASE id
      WHEN '10000000-0000-0000-0000-000000000001'::uuid THEN 'Pembeli responsif dan pembayaran cepat.'
      WHEN '10000000-0000-0000-0000-000000000002'::uuid THEN 'Brief jelas dan mudah diajak koordinasi.'
      WHEN '10000000-0000-0000-0000-000000000003'::uuid THEN 'Kandidat profesional dan komunikatif.'
      WHEN '10000000-0000-0000-0000-000000000004'::uuid THEN 'Klien kooperatif saat survey.'
      ELSE 'Transaksi lancar.'
    END AS seller_comment
  FROM inserted_tx
)
INSERT INTO reviews (
  transaction_id, content_id, reviewer_id, reviewee_id, rating, comment, created_at
)
SELECT
  id,
  content_id,
  buyer_id,
  seller_id,
  buyer_rating,
  buyer_comment,
  NOW() - INTERVAL '10 days'
FROM seed_reviews
UNION ALL
SELECT
  id,
  content_id,
  seller_id,
  buyer_id,
  seller_rating,
  seller_comment,
  NOW() - INTERVAL '9 days'
FROM seed_reviews
ON CONFLICT DO NOTHING;

SELECT 1;
