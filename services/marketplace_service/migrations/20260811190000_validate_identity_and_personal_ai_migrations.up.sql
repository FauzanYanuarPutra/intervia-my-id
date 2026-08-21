-- Read-only / assertion-style post-migration validation for Lajukan.
-- Run against the database(s) containing the relevant tables after migrations.
-- The blocks raise an exception on schema/postcondition drift.

DO $$
DECLARE
    missing_columns text[];
BEGIN
    SELECT array_agg(required.column_name ORDER BY required.column_name)
    INTO missing_columns
    FROM (
        VALUES
            ('identity_has_email'),
            ('identity_has_phone'),
            ('identity_user_email_verified'),
            ('identity_user_phone_verified'),
            ('identity_user_active'),
            ('identity_user_updated_at'),
            ('identity_user_event_id'),
            ('identity_user_operation'),
            ('identity_profile_updated_at'),
            ('identity_profile_event_id'),
            ('identity_profile_operation')
    ) AS required(column_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'users_read_model'
          AND c.column_name = required.column_name
    );

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION
            'users_read_model identity projection columns missing: %',
            missing_columns;
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.users_read_model
        WHERE email IS NOT NULL OR phone IS NOT NULL
    ) THEN
        RAISE EXCEPTION
            'users_read_model still contains raw email/phone values after privacy scrub';
    END IF;
END;
$$;

DO $$
DECLARE
    default_expr text;
BEGIN
    SELECT pg_get_expr(d.adbin, d.adrelid)
    INTO default_expr
    FROM pg_catalog.pg_attribute a
    JOIN pg_catalog.pg_class c
      ON c.oid = a.attrelid
    JOIN pg_catalog.pg_namespace n
      ON n.oid = c.relnamespace
    LEFT JOIN pg_catalog.pg_attrdef d
      ON d.adrelid = a.attrelid
     AND d.adnum = a.attnum
    WHERE n.nspname = 'public'
      AND c.relname = 'personal_ai_agents'
      AND a.attname = 'memory_enabled'
      AND NOT a.attisdropped;

    IF default_expr IS NULL
       OR lower(replace(default_expr, '::boolean', '')) NOT IN ('false', '''false''') THEN
        RAISE EXCEPTION
            'personal_ai_agents.memory_enabled default is not FALSE: %',
            default_expr;
    END IF;
END;
$$;

DO $$
BEGIN
    IF to_regclass('public.personal_ai_memory_preferences') IS NULL THEN
        RAISE EXCEPTION 'personal_ai_memory_preferences is missing';
    END IF;

    IF to_regclass('public.personal_ai_chat_requests') IS NULL THEN
        RAISE EXCEPTION 'personal_ai_chat_requests is missing';
    END IF;

    IF to_regclass('public.personal_ai_chat_requests_processing_lease_idx') IS NULL THEN
        RAISE EXCEPTION 'personal_ai_chat_requests_processing_lease_idx is missing';
    END IF;

    IF to_regprocedure('public.personal_ai_touch_updated_at()') IS NULL THEN
        RAISE EXCEPTION 'personal_ai_touch_updated_at() is missing';
    END IF;
END;
$$;

-- Human-readable summary.
SELECT
    'identity_projection' AS check_name,
    count(*) AS total_rows,
    count(*) FILTER (WHERE email IS NOT NULL OR phone IS NOT NULL) AS rows_with_raw_contact,
    count(*) FILTER (WHERE transaction_eligible) AS transaction_eligible_rows
FROM public.users_read_model;

SELECT
    'personal_ai_memory_preferences' AS check_name,
    count(*) AS total_rows,
    count(*) FILTER (WHERE enabled) AS opted_in_rows
FROM public.personal_ai_memory_preferences;

SELECT
    'personal_ai_chat_requests' AS check_name,
    count(*) AS total_rows,
    count(*) FILTER (WHERE status = 'processing') AS processing_rows,
    count(*) FILTER (
        WHERE status = 'processing'
          AND lease_expires_at <= NOW()
    ) AS expired_processing_rows,
    count(*) FILTER (WHERE status = 'completed') AS completed_rows
FROM public.personal_ai_chat_requests;