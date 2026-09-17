CREATE TABLE IF NOT EXISTS community_rate_limit_counters (
    rate_key TEXT NOT NULL,
    window_bucket BIGINT NOT NULL,
    count BIGINT NOT NULL DEFAULT 1 CHECK (count > 0),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (rate_key, window_bucket)
);

CREATE INDEX IF NOT EXISTS community_rate_limit_counters_expires_at_idx
    ON community_rate_limit_counters (expires_at);
