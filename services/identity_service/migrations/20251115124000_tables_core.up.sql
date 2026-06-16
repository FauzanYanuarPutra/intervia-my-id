-- 20251115124000_tables_core.up.sql
-- events.audit_logs table
CREATE TABLE IF NOT EXISTS events.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID,
    user_id UUID,
    entity TEXT NOT NULL,
    action TEXT NOT NULL,
    metadata JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON events.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON events.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON events.audit_logs (entity);