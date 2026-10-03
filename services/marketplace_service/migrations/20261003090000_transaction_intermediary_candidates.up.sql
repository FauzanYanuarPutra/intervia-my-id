CREATE TABLE IF NOT EXISTS transaction_intermediary_candidates (
  email CITEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  display_name TEXT NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_intermediary_candidates_enabled
  ON transaction_intermediary_candidates (enabled, email);

INSERT INTO transaction_intermediary_candidates (email, enabled, display_name, note)
VALUES
  ('lajukan001@gmail.com', TRUE, 'Lajukan Intermediary 1', 'Perantara resmi Lajukan'),
  ('fauzanyanuarp@gmail.com', TRUE, 'Lajukan Intermediary 2', 'Perantara resmi Lajukan')
ON CONFLICT (email) DO UPDATE
SET enabled = EXCLUDED.enabled,
    display_name = EXCLUDED.display_name,
    note = EXCLUDED.note,
    updated_at = NOW();
