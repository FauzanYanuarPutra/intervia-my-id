-- update timestamp
CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS TRIGGER AS $func$ BEGIN NEW.updated_at = NOW();
RETURN NEW;
END;
$func$ LANGUAGE plpgsql;
-- audit row changes
CREATE OR REPLACE FUNCTION public.audit_row_changes() RETURNS TRIGGER AS $func$
DECLARE actor uuid;
payload jsonb;
target_user uuid;
BEGIN BEGIN actor := current_setting('app.current_user_id', true)::uuid;
EXCEPTION
WHEN others THEN actor := NULL;
END;
IF TG_OP = 'DELETE' THEN payload := jsonb_build_object('old', to_jsonb(OLD));
ELSIF TG_OP = 'UPDATE' THEN payload := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
ELSE payload := jsonb_build_object('new', to_jsonb(NEW));
END IF;
-- SAFE EXTRACT (tidak crash walaupun field tidak ada)
BEGIN target_user := COALESCE(
    (to_jsonb(NEW)->>'id')::uuid,
    (to_jsonb(OLD)->>'id')::uuid,
    (to_jsonb(NEW)->>'user_id')::uuid,
    (to_jsonb(OLD)->>'user_id')::uuid
);
EXCEPTION
WHEN others THEN target_user := NULL;
END;
INSERT INTO events.audit_logs (
        actor_id,
        user_id,
        entity,
        action,
        metadata,
        created_at
    )
VALUES (
        actor,
        target_user,
        TG_TABLE_NAME,
        TG_OP,
        payload,
        NOW()
    );
RETURN COALESCE(NEW, OLD);
END;
$func$ LANGUAGE plpgsql;
-- track updated_by
CREATE OR REPLACE FUNCTION public.track_updated_by() RETURNS TRIGGER AS $func$ BEGIN BEGIN NEW.updated_by := current_setting('app.current_user_id', true)::uuid;
EXCEPTION
WHEN others THEN NEW.updated_by := NULL;
END;
RETURN NEW;
END;
$func$ LANGUAGE plpgsql;
-- slugify tanpa unaccent
CREATE OR REPLACE FUNCTION public.slugify(value TEXT) RETURNS TEXT AS $$
SELECT regexp_replace(
        lower(value),
        '[^a-z0-9\.]+',
        '-',
        'g'
    );
$$ LANGUAGE SQL IMMUTABLE STRICT;
-- normalize org slug
CREATE OR REPLACE FUNCTION public.normalize_org_slug() RETURNS TRIGGER AS $func$ BEGIN IF NEW.slug IS NULL THEN NEW.slug := public.slugify(NEW.name);
END IF;
RETURN NEW;
END;
$func$ LANGUAGE plpgsql;