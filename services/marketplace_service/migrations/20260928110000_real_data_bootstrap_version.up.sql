ALTER TABLE real_data_bootstrap_runs
  ADD COLUMN IF NOT EXISTS bootstrap_version TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_real_data_bootstrap_version
  ON real_data_bootstrap_runs(bootstrap_version);
