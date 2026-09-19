CREATE TABLE IF NOT EXISTS service_meta (
  service_name TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO service_meta(service_name,schema_version)
VALUES ('news_service','domain-bootstrap-v1')
ON CONFLICT (service_name) DO UPDATE SET schema_version=EXCLUDED.schema_version, updated_at=NOW();
