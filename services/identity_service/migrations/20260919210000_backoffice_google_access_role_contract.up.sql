-- Reconcile the initial backoffice Google allowlist with the application role contract.
-- CRM is limited to admin/sales/support; CMS may use admin/content_admin.
UPDATE core.backoffice_google_access
SET role_names = ARRAY['admin','sales','support'],
    updated_at = NOW()
WHERE lower(email::text) = 'lajukan001@gmail.com'
  AND application = 'crm'
  AND role_names <> ARRAY['admin','sales','support'];

COMMENT ON TABLE core.backoffice_google_access IS
'Explicit Google identities approved for first-party CRM/CMS access; no self-registration.';
