DROP INDEX IF EXISTS idx_real_data_bootstrap_version;
ALTER TABLE real_data_bootstrap_runs
  DROP COLUMN IF EXISTS bootstrap_version;
