-- Durable state for the external real-data bootstrap worker.
-- A successful run is idempotent and can be refreshed without duplicating rows.
CREATE TABLE IF NOT EXISTS real_data_bootstrap_runs (
    bootstrap_key TEXT PRIMARY KEY,
    last_success_at TIMESTAMPTZ,
    last_provider_count INTEGER NOT NULL DEFAULT 0,
    last_buyer_count INTEGER NOT NULL DEFAULT 0,
    last_community_media_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO real_data_bootstrap_runs (bootstrap_key)
VALUES ('real_marketplace_open_data')
ON CONFLICT (bootstrap_key) DO NOTHING;
