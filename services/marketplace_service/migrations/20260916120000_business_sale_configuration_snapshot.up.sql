-- Flow Usaha: expose immutable configuration/note snapshots as first-class sale-line columns.
-- The Marketplace writer already stores the normalized, server-authoritative configuration
-- inside cost_snapshot.configuration. Generated columns keep existing and future rows in sync
-- without introducing a second mutable source of truth.
ALTER TABLE business_sale_lines
  ADD COLUMN configuration_snapshot JSONB
    GENERATED ALWAYS AS (
      COALESCE(cost_snapshot -> 'configuration', '{}'::jsonb)
    ) STORED,
  ADD COLUMN line_note TEXT
    GENERATED ALWAYS AS (
      NULLIF(cost_snapshot #>> '{configuration,note}', '')
    ) STORED;

COMMENT ON COLUMN business_sale_lines.configuration_snapshot IS
  'Immutable server-authoritative modifier configuration snapshot derived from cost_snapshot at sale creation.';

COMMENT ON COLUMN business_sale_lines.line_note IS
  'Immutable normalized line note derived from the sale configuration snapshot.';
