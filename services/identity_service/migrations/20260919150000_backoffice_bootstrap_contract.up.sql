-- Backoffice bootstrap contract.
-- Passwords are intentionally NOT stored in migrations. The companion
-- bootstrap_backoffice binary receives them only from deployment secrets.
CREATE TABLE IF NOT EXISTS core.backoffice_bootstrap_slots (
    slot TEXT PRIMARY KEY,
    role_names TEXT[] NOT NULL,
    password_env_key TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT backoffice_bootstrap_slot_name_check
        CHECK (slot IN ('admin', 'agent'))
);

DROP TRIGGER IF EXISTS backoffice_bootstrap_slots_update_timestamp
    ON core.backoffice_bootstrap_slots;

CREATE TRIGGER backoffice_bootstrap_slots_update_timestamp
BEFORE UPDATE ON core.backoffice_bootstrap_slots
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

INSERT INTO core.roles (id, name, description, system, role_type)
VALUES
    (gen_random_uuid(), 'admin', 'Platform backoffice administrator', TRUE, 'global'),
    (gen_random_uuid(), 'content_admin', 'CMS editorial administrator', TRUE, 'global'),
    (gen_random_uuid(), 'sales', 'CRM sales operator', TRUE, 'global'),
    (gen_random_uuid(), 'support', 'CRM support operator', TRUE, 'global')
ON CONFLICT (name) DO NOTHING;

INSERT INTO core.backoffice_bootstrap_slots (slot, role_names, password_env_key)
VALUES
    ('admin', ARRAY['admin', 'content_admin', 'sales', 'support'], 'BACKOFFICE_ADMIN_PASSWORD'),
    ('agent', ARRAY['sales', 'support'], 'BACKOFFICE_AGENT_PASSWORD')
ON CONFLICT (slot) DO UPDATE
SET role_names = EXCLUDED.role_names,
    password_env_key = EXCLUDED.password_env_key,
    enabled = TRUE,
    updated_at = NOW();
