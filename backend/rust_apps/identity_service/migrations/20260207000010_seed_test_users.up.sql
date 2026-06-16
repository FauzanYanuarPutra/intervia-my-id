-- Seed test user accounts for development and testing
-- Password for all test accounts: "Test123!@#"
-- Hashed with argon2id (compatible with current auth implementation)
-- full_name lives in user_profiles, not users

-- Ensure audit trigger works on tables without `id` column (e.g. user_profiles).
CREATE OR REPLACE FUNCTION public.audit_row_changes() RETURNS TRIGGER AS $func$
DECLARE
    actor uuid;
    payload jsonb;
    row_new jsonb;
    row_old jsonb;
    target_user_text text;
    target_user uuid;
BEGIN
    BEGIN
        actor := current_setting('app.current_user_id', true)::uuid;
    EXCEPTION
        WHEN others THEN actor := NULL;
    END;

    IF TG_OP = 'DELETE' THEN
        row_old := to_jsonb(OLD);
        payload := jsonb_build_object('old', row_old);
    ELSIF TG_OP = 'UPDATE' THEN
        row_new := to_jsonb(NEW);
        row_old := to_jsonb(OLD);
        payload := jsonb_build_object('old', row_old, 'new', row_new);
    ELSE
        row_new := to_jsonb(NEW);
        payload := jsonb_build_object('new', row_new);
    END IF;

    target_user_text := COALESCE(
        row_new ->> 'id',
        row_old ->> 'id',
        row_new ->> 'user_id',
        row_old ->> 'user_id'
    );

    IF target_user_text IS NOT NULL THEN
        BEGIN
            target_user := target_user_text::uuid;
        EXCEPTION
            WHEN others THEN target_user := NULL;
        END;
    ELSE
        target_user := NULL;
    END IF;

    INSERT INTO audit_logs (actor_id, user_id, entity, action, metadata, created_at)
    VALUES (actor, target_user, TG_TABLE_NAME, TG_OP, payload, NOW());

    RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;

INSERT INTO users (
    id, email, password_hash, phone,
    email_verified, status, created_at, updated_at
) VALUES
-- Super Admin Account
(
    '00000000-0000-0000-0000-000000000001',
    'admin@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', -- Test123!@#
    '6282117148623',
    TRUE,
    'active',
    NOW(),
    NOW()
),
-- Regular User / Buyer Account
(
    '00000000-0000-0000-0000-000000000002',
    'user@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', -- Test123!@#
    '6281100000002',
    TRUE,
    'active',
    NOW(),
    NOW()
),
-- Freelancer / Talent Account
(
    '00000000-0000-0000-0000-000000000003',
    'freelancer@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', -- Test123!@#
    '6281100000003',
    TRUE,
    'active',
    NOW(),
    NOW()
),
-- Employer / Company Account
(
    '00000000-0000-0000-0000-000000000004',
    'employer@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', -- Test123!@#
    '6281100000004',
    TRUE,
    'active',
    NOW(),
    NOW()
),
-- Property Agent Account
(
    '00000000-0000-0000-0000-000000000005',
    'agent@lajukan.com',
    '$argon2id$v=19$m=19456,t=2,p=1$HBsn6bApIb0qf8ZiPScfkw$mu19wnRAn+pogPsv4/HyqTilWQtOEFxnAFgZktdH068', -- Test123!@#
    '6281100000005',
    TRUE,
    'active',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE
SET
    password_hash = EXCLUDED.password_hash,
    email_verified = EXCLUDED.email_verified,
    status = EXCLUDED.status,
    failed_login_attempts = 0,
    lockout_expires_at = NULL,
    deleted_at = NULL,
    updated_at = NOW();

-- Seed display names in user_profiles (full_name is on user_profiles, not users)
INSERT INTO user_profiles (user_id, full_name, updated_at)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Super Admin', NOW()),
    ('00000000-0000-0000-0000-000000000002', 'Regular User', NOW()),
    ('00000000-0000-0000-0000-000000000003', 'Freelancer Pro', NOW()),
    ('00000000-0000-0000-0000-000000000004', 'Tech Company HR', NOW()),
    ('00000000-0000-0000-0000-000000000005', 'Property Agent', NOW())
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, updated_at = EXCLUDED.updated_at;

-- Assign roles to test users
INSERT INTO user_roles (user_id, role_id)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    id
FROM roles
WHERE name = 'super_admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT 
    u.id::uuid,
    r.id
FROM (VALUES 
    ('00000000-0000-0000-0000-000000000002'),
    ('00000000-0000-0000-0000-000000000003'),
    ('00000000-0000-0000-0000-000000000004'),
    ('00000000-0000-0000-0000-000000000005')
) AS u(id)
CROSS JOIN roles r
WHERE r.name = 'buyer'
ON CONFLICT DO NOTHING;

SELECT 1; -- Migration complete
