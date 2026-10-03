CREATE TABLE IF NOT EXISTS events.content_view_dedup (
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  viewer_key TEXT NOT NULL,
  view_date DATE NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (entity_type, entity_id, viewer_key, view_date)
);

CREATE INDEX IF NOT EXISTS idx_content_view_dedup_date_entity
  ON events.content_view_dedup (view_date, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_content_view_dedup_entity_date
  ON events.content_view_dedup (entity_type, entity_id, view_date);
