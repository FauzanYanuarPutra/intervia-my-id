-- Controlled Google access for first-party backoffice applications.
-- CRM/CMS are not public Google-registration surfaces. An email must be
-- explicitly approved here before OAuth can provision or link a local account.
CREATE TABLE IF NOT EXISTS core.backoffice_google_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email CITEXT NOT NULL,
    application TEXT NOT NULL CHECK (application IN ('crm', 'cms')),
    role_names TEXT[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'approved'
        CHECK (status IN ('pending', 'approved', 'revoked')),
    granted_by UUID REFERENCES core.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_backoffice_google_access_email_app
    ON core.backoffice_google_access (lower(email::text), application);

CREATE INDEX IF NOT EXISTS idx_backoffice_google_access_lookup
    ON core.backoffice_google_access (lower(email::text), application, status);

DROP TRIGGER IF EXISTS backoffice_google_access_update_timestamp
    ON core.backoffice_google_access;

CREATE TRIGGER backoffice_google_access_update_timestamp
BEFORE UPDATE ON core.backoffice_google_access
FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- Platform owner is the only Google identity pre-approved by seed.
-- The bootstrap binary remains responsible for creating the actual owner
-- account and its password secret; no password is stored here.
INSERT INTO core.backoffice_google_access (email, application, role_names, status)
VALUES
    ('lajukan001@gmail.com', 'crm',
        ARRAY['admin','content_admin','sales','support'], 'approved'),
    ('lajukan001@gmail.com', 'cms',
        ARRAY['admin','content_admin'], 'approved')
ON CONFLICT (lower(email::text), application) DO UPDATE
SET role_names = EXCLUDED.role_names,
    status = 'approved',
    updated_at = NOW();
