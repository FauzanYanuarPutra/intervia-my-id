ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_format;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
ADD CONSTRAINT users_email_format CHECK (
    email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_format;
ALTER TABLE users
ADD CONSTRAINT users_phone_format CHECK (
    phone IS NULL OR regexp_replace(phone, '[^0-9]', '', 'g') ~ '^[0-9]{8,15}$'
);

WITH ranked_phones AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g')
            ORDER BY created_at, id
        ) AS rn
    FROM users
    WHERE deleted_at IS NULL
      AND regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') <> ''
)
UPDATE users
SET
    phone = NULL,
    phone_verified = FALSE,
    updated_at = NOW()
WHERE id IN (
    SELECT id
    FROM ranked_phones
    WHERE rn > 1
);

DROP INDEX IF EXISTS idx_users_phone_normalized_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_normalized_unique
ON users ((regexp_replace(phone, '[^0-9]', '', 'g')))
WHERE deleted_at IS NULL AND phone IS NOT NULL;

WITH seed_users AS (
    SELECT *
    FROM (
        VALUES
            ('00000000-0000-0000-0000-000000000001'::uuid, '6281100000001', 'admin@lajukan.com', TRUE),
            ('00000000-0000-0000-0000-000000000002'::uuid, '6281100000002', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000003'::uuid, '6281100000003', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000004'::uuid, '6281100000004', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000005'::uuid, '6281100000005', 'agent@lajukan.com', TRUE),
            ('00000000-0000-0000-0000-000000000101'::uuid, '6281100000101', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000102'::uuid, '6281100000102', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000103'::uuid, '6281100000103', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000201'::uuid, '6281100000201', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000202'::uuid, '6281100000202', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000301'::uuid, '6281100000301', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000401'::uuid, '6281100000401', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000511'::uuid, '6281100000511', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000512'::uuid, '6281100000512', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000513'::uuid, '6281100000513', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000514'::uuid, '6281100000514', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000515'::uuid, '6281100000515', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000516'::uuid, '6281100000516', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000517'::uuid, '6281100000517', NULL, FALSE),
            ('00000000-0000-0000-0000-000000000518'::uuid, '6281100000518', NULL, FALSE)
    ) AS seed(id, phone, email, keep_password)
)
UPDATE users AS u
SET
    phone = seed.phone,
    phone_verified = TRUE,
    email = seed.email,
    email_verified = CASE WHEN seed.email IS NOT NULL THEN TRUE ELSE FALSE END,
    password_hash = CASE WHEN seed.keep_password THEN u.password_hash ELSE NULL END,
    failed_login_attempts = 0,
    lockout_expires_at = NULL,
    deleted_at = NULL,
    is_active = TRUE,
    status = 'active',
    updated_at = NOW()
FROM seed_users AS seed
WHERE u.id = seed.id;

DELETE FROM sessions
WHERE user_id IN (
    SELECT id
    FROM (
        VALUES
            ('00000000-0000-0000-0000-000000000001'::uuid),
            ('00000000-0000-0000-0000-000000000002'::uuid),
            ('00000000-0000-0000-0000-000000000003'::uuid),
            ('00000000-0000-0000-0000-000000000004'::uuid),
            ('00000000-0000-0000-0000-000000000005'::uuid),
            ('00000000-0000-0000-0000-000000000101'::uuid),
            ('00000000-0000-0000-0000-000000000102'::uuid),
            ('00000000-0000-0000-0000-000000000103'::uuid),
            ('00000000-0000-0000-0000-000000000201'::uuid),
            ('00000000-0000-0000-0000-000000000202'::uuid),
            ('00000000-0000-0000-0000-000000000301'::uuid),
            ('00000000-0000-0000-0000-000000000401'::uuid),
            ('00000000-0000-0000-0000-000000000511'::uuid),
            ('00000000-0000-0000-0000-000000000512'::uuid),
            ('00000000-0000-0000-0000-000000000513'::uuid),
            ('00000000-0000-0000-0000-000000000514'::uuid),
            ('00000000-0000-0000-0000-000000000515'::uuid),
            ('00000000-0000-0000-0000-000000000516'::uuid),
            ('00000000-0000-0000-0000-000000000517'::uuid),
            ('00000000-0000-0000-0000-000000000518'::uuid)
    ) AS seed_ids(id)
);

SELECT 1;
