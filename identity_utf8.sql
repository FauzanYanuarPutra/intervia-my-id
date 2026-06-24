--
-- PostgreSQL database dump
--

\restrict szYeYbjnXPEuye0aJaJPVVohbgUC1LMO81bYfekFsKvCZHlAEHlBMBEUBWTn75X

-- Dumped from database version 16.14
-- Dumped by pg_dump version 16.14

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: audit; Type: SCHEMA; Schema: -; Owner: app
--

CREATE SCHEMA audit;


ALTER SCHEMA audit OWNER TO app;

--
-- Name: core; Type: SCHEMA; Schema: -; Owner: app
--

CREATE SCHEMA core;


ALTER SCHEMA core OWNER TO app;

--
-- Name: events; Type: SCHEMA; Schema: -; Owner: app
--

CREATE SCHEMA events;


ALTER SCHEMA events OWNER TO app;

--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: app
--

CREATE SCHEMA identity;


ALTER SCHEMA identity OWNER TO app;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: user_status; Type: TYPE; Schema: core; Owner: app
--

CREATE TYPE core.user_status AS ENUM (
    'active',
    'disabled',
    'banned',
    'pending'
);


ALTER TYPE core.user_status OWNER TO app;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: user_profiles; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.user_profiles (
    user_id uuid NOT NULL,
    full_name text,
    bio text,
    picture text,
    username public.citext,
    birthdate date,
    location text,
    search_tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, ((COALESCE(full_name, ''::text) || ' '::text) || COALESCE(bio, ''::text)))) STORED,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    metadata jsonb DEFAULT '{}'::jsonb
);


ALTER TABLE core.user_profiles OWNER TO app;

--
-- Name: get_hourly_rate(core.user_profiles); Type: FUNCTION; Schema: core; Owner: app
--

CREATE FUNCTION core.get_hourly_rate(profile core.user_profiles) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$

SELECT COALESCE(

    (

      profile.metadata->'freelancer_profile'->>'hourly_rate'

    )::integer,

    0

  );

$$;


ALTER FUNCTION core.get_hourly_rate(profile core.user_profiles) OWNER TO app;

--
-- Name: is_freelancer(core.user_profiles); Type: FUNCTION; Schema: core; Owner: app
--

CREATE FUNCTION core.is_freelancer(profile core.user_profiles) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$

SELECT profile.metadata->'roles' ? 'freelancer';

$$;


ALTER FUNCTION core.is_freelancer(profile core.user_profiles) OWNER TO app;

--
-- Name: audit_row_changes(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.audit_row_changes() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

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

$$;


ALTER FUNCTION public.audit_row_changes() OWNER TO app;

--
-- Name: enqueue_identity_user_event(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.enqueue_identity_user_event() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  event_payload jsonb;
  aggregate_id text;
  action_name text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    event_payload := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'user_profiles' THEN
      aggregate_id := OLD.user_id::text;
    ELSE
      aggregate_id := OLD.id::text;
    END IF;
  ELSE
    event_payload := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'user_profiles' THEN
      aggregate_id := NEW.user_id::text;
    ELSE
      aggregate_id := NEW.id::text;
    END IF;
  END IF;

  action_name := CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    WHEN 'DELETE' THEN 'deleted'
    ELSE lower(TG_OP)
  END;

  INSERT INTO events.event_outbox (
    aggregate_type,
    aggregate_id,
    event_type,
    routing_key,
    payload,
    headers
  )
  VALUES (
    'identity.user',
    aggregate_id,
    CASE
      WHEN TG_TABLE_NAME = 'user_profiles' THEN 'identity.user_profile.' || action_name
      ELSE 'identity.user.' || action_name
    END,
    'identity.user.' || action_name,
    jsonb_build_object(
      'schema_version', 1,
      'source', 'identity_service',
      'table', TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME,
      'operation', TG_OP,
      'user_id', aggregate_id,
      'data', event_payload
    ),
    jsonb_build_object('content_type', 'application/json')
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION public.enqueue_identity_user_event() OWNER TO app;

--
-- Name: is_system_admin(uuid); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.is_system_admin(uid uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$

SELECT EXISTS (

        SELECT 1

        FROM core.user_roles ur

            JOIN roles r ON r.id = ur.role_id

        WHERE ur.user_id = uid

            AND lower(r.name) = 'super_admin'

    );

$$;


ALTER FUNCTION public.is_system_admin(uid uuid) OWNER TO app;

--
-- Name: normalize_org_slug(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.normalize_org_slug() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF NEW.slug IS NULL THEN NEW.slug := public.slugify(NEW.name);

END IF;

RETURN NEW;

END;

$$;


ALTER FUNCTION public.normalize_org_slug() OWNER TO app;

--
-- Name: normalize_username(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.normalize_username() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF NEW.username IS NOT NULL THEN NEW.username = lower(trim(NEW.username));

END IF;

RETURN NEW;

END;

$$;


ALTER FUNCTION public.normalize_username() OWNER TO app;

--
-- Name: org_owner_is_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.org_owner_is_member(org_id uuid, owner_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$

SELECT EXISTS (

        SELECT 1

        FROM organization_users ou

        WHERE ou.org_id = org_id

            AND ou.user_id = owner_user_id

    );

$$;


ALTER FUNCTION public.org_owner_is_member(org_id uuid, owner_user_id uuid) OWNER TO app;

--
-- Name: prevent_delete_system_roles(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.prevent_delete_system_roles() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF OLD.system = TRUE THEN RAISE EXCEPTION 'Cannot delete system-protected role.';

END IF;

RETURN OLD;

END;

$$;


ALTER FUNCTION public.prevent_delete_system_roles() OWNER TO app;

--
-- Name: prevent_remove_last_org_admin(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.prevent_remove_last_org_admin() RETURNS trigger
    LANGUAGE plpgsql
    AS $$

DECLARE admin_count INT;

org uuid;

role_uuid uuid;

BEGIN IF TG_OP = 'DELETE' THEN org := OLD.org_id;

-- find role id for 'org_admin' (if missing, skip)

SELECT id INTO role_uuid

FROM roles

WHERE lower(name) = 'org_admin'

LIMIT 1;

IF role_uuid IS NULL THEN RETURN OLD;

END IF;

-- Check how many admins are left for this organization

SELECT COUNT(*) INTO admin_count

FROM organization_users

WHERE org_id = org

    AND role_id = role_uuid;

-- if deleting an admin row and it is the last one, prevent

IF OLD.role_id = role_uuid

AND admin_count <= 1 THEN RAISE EXCEPTION 'Cannot remove last org_admin from organization %',

org;

END IF;

END IF;

RETURN OLD;

END;

$$;


ALTER FUNCTION public.prevent_remove_last_org_admin() OWNER TO app;

--
-- Name: reset_login_attempts_on_password_change(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.reset_login_attempts_on_password_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN IF NEW.password_hash IS DISTINCT

FROM OLD.password_hash THEN NEW.failed_login_attempts = 0;

NEW.lockout_expires_at = NULL;

END IF;

RETURN NEW;

END;

$$;


ALTER FUNCTION public.reset_login_attempts_on_password_change() OWNER TO app;

--
-- Name: slugify(text); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.slugify(value text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$

SELECT regexp_replace(

        lower(value),

        '[^a-z0-9\.]+',

        '-',

        'g'

    );

$$;


ALTER FUNCTION public.slugify(value text) OWNER TO app;

--
-- Name: track_updated_by(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.track_updated_by() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN BEGIN NEW.updated_by := current_setting('app.current_user_id', true)::uuid;

EXCEPTION

WHEN others THEN NEW.updated_by := NULL;

END;

RETURN NEW;

END;

$$;


ALTER FUNCTION public.track_updated_by() OWNER TO app;

--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: app
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$;


ALTER FUNCTION public.update_timestamp() OWNER TO app;

--
-- Name: _sqlx_migrations; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);


ALTER TABLE core._sqlx_migrations OWNER TO app;

--
-- Name: group_roles; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.group_roles (
    group_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE core.group_roles OWNER TO app;

--
-- Name: group_users; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.group_users (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE core.group_users OWNER TO app;

--
-- Name: groups; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    org_id uuid,
    name public.citext NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE core.groups OWNER TO app;

--
-- Name: organization_users; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.organization_users (
    org_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid,
    status text DEFAULT 'active'::text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE core.organization_users OWNER TO app;

--
-- Name: organizations; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name public.citext NOT NULL,
    slug public.citext,
    owner_user_id uuid,
    deleted_at timestamp with time zone,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT owner_is_member CHECK (((owner_user_id IS NULL) OR public.org_owner_is_member(id, owner_user_id)))
);


ALTER TABLE core.organizations OWNER TO app;

--
-- Name: permissions; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.permissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name public.citext NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE core.permissions OWNER TO app;

--
-- Name: role_permissions; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.role_permissions (
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


ALTER TABLE core.role_permissions OWNER TO app;

--
-- Name: roles; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name public.citext NOT NULL,
    description text,
    system boolean DEFAULT false,
    role_type text DEFAULT 'global'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE core.roles OWNER TO app;

--
-- Name: sessions; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    refresh_token_hash text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    rotated_from uuid,
    revoked boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE core.sessions OWNER TO app;

--
-- Name: user_identities; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.user_identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    provider_user_id text NOT NULL,
    email public.citext,
    email_verified boolean DEFAULT false NOT NULL,
    raw_profile jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    last_login_at timestamp with time zone,
    CONSTRAINT user_identities_provider_check CHECK ((provider <> ''::text)),
    CONSTRAINT user_identities_provider_user_id_check CHECK ((provider_user_id <> ''::text))
);


ALTER TABLE core.user_identities OWNER TO app;

--
-- Name: user_roles; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.user_roles (
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE core.user_roles OWNER TO app;

--
-- Name: users; Type: TABLE; Schema: core; Owner: app
--

CREATE TABLE core.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext,
    email_verified boolean DEFAULT false,
    password_hash text,
    password_changed_at timestamp with time zone DEFAULT now(),
    phone text,
    phone_verified boolean DEFAULT false,
    status core.user_status DEFAULT 'active'::core.user_status,
    is_active boolean DEFAULT true,
    failed_login_attempts smallint DEFAULT 0,
    lockout_expires_at timestamp with time zone,
    last_login_at timestamp with time zone,
    deleted_at timestamp with time zone,
    public_key_jwks jsonb,
    actor_id uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT users_email_format CHECK (((email IS NULL) OR (email OPERATOR(public.~*) '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::public.citext))),
    CONSTRAINT users_is_active_check CHECK ((is_active = (status = 'active'::core.user_status))),
    CONSTRAINT users_phone_format CHECK (((phone IS NULL) OR (regexp_replace(phone, '[^0-9]'::text, ''::text, 'g'::text) ~ '^[0-9]{8,15}$'::text)))
);


ALTER TABLE core.users OWNER TO app;

--
-- Name: audit_logs; Type: TABLE; Schema: events; Owner: app
--

CREATE TABLE events.audit_logs (
    id bigint NOT NULL,
    actor_id uuid,
    user_id uuid,
    entity text NOT NULL,
    action text NOT NULL,
    metadata jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE events.audit_logs OWNER TO app;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: events; Owner: app
--

CREATE SEQUENCE events.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE events.audit_logs_id_seq OWNER TO app;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: events; Owner: app
--

ALTER SEQUENCE events.audit_logs_id_seq OWNED BY events.audit_logs.id;


--
-- Name: event_outbox; Type: TABLE; Schema: events; Owner: app
--

CREATE TABLE events.event_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    event_type text NOT NULL,
    routing_key text NOT NULL,
    payload jsonb NOT NULL,
    headers jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    error_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'publishing'::text, 'published'::text, 'failed'::text])))
);


ALTER TABLE events.event_outbox OWNER TO app;

--
-- Name: _sqlx_migrations; Type: TABLE; Schema: public; Owner: app
--

CREATE TABLE public._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);


ALTER TABLE public._sqlx_migrations OWNER TO app;

--
-- Name: audit_logs id; Type: DEFAULT; Schema: events; Owner: app
--

ALTER TABLE ONLY events.audit_logs ALTER COLUMN id SET DEFAULT nextval('events.audit_logs_id_seq'::regclass);


--
-- Data for Name: _sqlx_migrations; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core._sqlx_migrations (version, description, installed_on, success, checksum, execution_time) FROM stdin;
1	init	2026-06-18 12:31:30.961888+00	t	\\xad62e6f4c961c51f36114a164fe525b430c6391a01cb1f7948f5c998cbd4c59e77424ca3dbe7f0b389efd392ba380fec	96235627
20251115122000	functions security	2026-06-18 12:31:31.099573+00	t	\\xc33dc543e6daa9c080e7f1fcb11e780bec24b82317fab3b2c8250783f98015d3cbe6f550e3e8df6a5c0bc77a0201172a	80619661
20251115123000	functions timestamp	2026-06-18 12:31:31.191612+00	t	\\x249fc9d9ddfb6853f067ea0512a9d0f02e53fb2757bda619b116971d9db2f393a89bba68e7d36159b6ef7fbd4721554a	19866760
20251115124000	tables core	2026-06-18 12:31:31.221412+00	t	\\x950799fd7e8e563393d2d8c55c437e7be419b1336b61cc1689de750fcafd7c91bd07cef147ee6cb52dfb0b6c6e6192d2	47709591
20251115125000	tables users	2026-06-18 12:31:31.274205+00	t	\\x0da3aec29fd1399d87b65aae3229494d38ebd12e880a3980ee320098f7289c6e41a1d803d776f14997d03be634a31d14	149532402
20251115126000	tables roles permissions	2026-06-18 12:31:31.431165+00	t	\\xdd525d6ff8b7ae9d9b997611359296e9120c239d1003f190efb05f07c2dac0fa2fc8ee7caf43194be6b89f218062b23d	77140785
20251115126040	tables sessions	2026-06-18 12:31:31.538417+00	t	\\x62bdf42a2dbe3875f1064742e8272035afa10b0bac0ba9ae3f7ee6051430851b15e88d0998f80d10ba23943519ba54cb	133343446
20251115126050	functions audit	2026-06-18 12:31:31.718169+00	t	\\x7c145ca5d69ab6f9b26f2f65132b1c897b6cbf9d6552890ae0bc96a14e5180f76f517d86fa99583b979d8eb0d114ad80	148578092
20251115127000	tables organizations	2026-06-18 12:31:31.876313+00	t	\\x1ccfe0810be65f30040a42e548243030583437715303c71c6494bd99f880eb766632d96e19f13f1e286e81106594230c	1785708014
20251115127050	functions org dependent	2026-06-18 12:31:33.694203+00	t	\\xd07374aa8b3718f3582ed784336051873feaaa1fe71019e78495a4cc40a3d2b1d37099744a41741540a73ac46ce7b122	13305672
20251115127060	add org constraints	2026-06-18 12:31:33.717716+00	t	\\x3a42ff0bc702684a61ea2c6c00c726bfd51699c54ba11664d758592fcb6cf79ba21c208409cc73e2f9d30e6b58b0c89b	25610124
20251115128000	tables groups	2026-06-18 12:31:33.775658+00	t	\\x637548d472372e0a099fa6a3965e20d1b9641869bdb9bab40cd2454cc9e9abad6a31a6a78d1db7326aee2ba3339ba246	1911270355
20251115129000	indexes performance	2026-06-18 12:31:35.720972+00	t	\\x1017a665cac13c32810b31359bd33d1d6082ed328c500e3472385b449090e1ca51264994d6639b0aeb6ece39c5673fe9	2261682196
20251115130000	triggers audit attach	2026-06-18 12:31:38.050543+00	t	\\xc926e4ee29d5d71389b08d74958cf04706c2feec2904f7afa749f9bc0eaa34f1d25f62f097b6a63eb77f33577c8bf241	188244298
20251115131000	row level security	2026-06-18 12:31:38.281428+00	t	\\x073243183fde39562b6a91cd4d5719932d7b82f243071a8ebace4d2d39d8d4095091c17488038ef64f25cd9b06cc5234	15471320
20251115131500	enable rls	2026-06-18 12:31:38.301469+00	t	\\x16b8023e7ce42bc93f319a52f7a9b248a97fd70dcba9e6ec24d3fe98e95e1bb2a60bd1eb07151489d1f0adbf6705f467	155241933
20251115132000	prevent last admin	2026-06-18 12:31:38.480762+00	t	\\x971f7ed3d518a62998a610430b5a4c963f9d3b80bbb62612bef0f515fec6cfd9de68f9d3c56991c3014284b44a465335	56338267
20251115133000	seeds and defaults	2026-06-18 12:31:38.580339+00	t	\\x02a84b8d9582565a5468000b8a14ef12eb29f3dc5afb0872c418af51d3ba8575b5ebecd1a399978467264614629a7ec0	173436857
20251125120000	update email constraint	2026-06-18 12:31:38.919677+00	t	\\xa70bb3ce791cbc88b564c2b279b7b85605141ba8e9d7f379eaf4427f17a746f9186d62af68b7eadadd1846a2a2efa73b	161655108
20260207000010	seed test users	2026-06-18 12:31:39.135048+00	t	\\x98db40bceb411aa587bfeacd80897f73132f79528151f34a375b4999961557b147dfdb6edcdd1574d169108276cbc060	174065010
20260209000000	add user metadata	2026-06-18 12:31:39.797751+00	t	\\xf0b9140400bb7761e68224de6e9dcd9344293e75e7413367dfbb490376231bbdf4dac09ae9ff7ff88fbf18f9636be535	385584887
20260218000000	harden users migration idempotency	2026-06-18 12:31:40.257139+00	t	\\x4d73f6a9b5bf818afc1e798fa9bb0549df2c9e02102e8a01e524b6e743c4fa56fbd7071cd69ce0b5b75e2c36116fab00	108959190
20260223001000	seed cms crm roles	2026-06-18 12:31:40.372637+00	t	\\x6dc56299a37117d46252393c299e0abfc838f263010c88f1ebbd6f21af8095db0d8998fd2a90647d8d66e255c8fa77b0	99857839
20260308113000	profile search performance	2026-06-18 12:31:40.501716+00	t	\\xd1464604906dac345695ec5e9d6bff0e648d0a683dc920d10fe2e5a148cb1fa83bea703691141ee94035acb1d3ec26c1	88753100
20260310091000	seed super app provider accounts	2026-06-18 12:31:40.616155+00	t	\\x03022c5e43ffe5c302d54144e9dfdf4577d006a0b59f820284b91fa55ce53db890a4fb5422ff2a05689c2623647d8d5f	-1
20260325102000	seed marketplace discover profiles	2026-06-18 12:31:58.009359+00	t	\\x20cf68efc595c3d51b9fe58290c981da9bdebdb5c883650dd286678d14da8d1e7745ab77b4d336a46337a862cace19fc	30431343
20260327100000	phone first auth reset	2026-06-18 12:31:58.06045+00	t	\\xc4cedd3361a4053f03629393632c45a4b14d727f5caf8f35020cd4fcaabae793e8e86c5fc319e33846fd6fc9bbf76491	349531730
20260616090000	identity user outbox	2026-06-18 12:31:58.426355+00	t	\\x046e504e7e1156fcf10246cdf4d175482fd66f39091d053c146f597e6d9f60677087c71acd9092e5912d522bcaa8281f	342959132
20260616193000	user identities	2026-06-18 12:31:58.77993+00	t	\\xe9e63b397367fbf973c968715e3814f2e5cb44ba4fa5797bf56b69df9294b4f1fb9315afa31f2a377f7fcfe4620bae93	43080320
\.


--
-- Data for Name: group_roles; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.group_roles (group_id, role_id) FROM stdin;
\.


--
-- Data for Name: group_users; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.group_users (group_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: groups; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.groups (id, org_id, name, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: organization_users; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.organization_users (org_id, user_id, role_id, status, created_at) FROM stdin;
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.organizations (id, name, slug, owner_user_id, deleted_at, updated_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.permissions (id, name, description, created_at, updated_at) FROM stdin;
652fdc71-733f-4ee5-92b4-b9e48ad8fca7	system:manage	Full system control	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
7fd70902-0006-4bc5-9e51-a020ed9082e8	system:view_logs	Read audit logs	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
8c146564-b7ce-424a-b40a-567beef1857e	system:update_roles	Manage global roles & permissions	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
17c65554-5677-465f-8a22-3f2a78bbde6c	org:create	Create organization	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
4eeb91ae-393d-4abc-81a7-2544beb2164e	org:read	Read organization	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
35e9947f-18d0-4cd8-9112-b548bfdffbb0	org:update	Update organization	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
ca52ad81-38ad-4780-b3a1-e16c09268754	org:delete	Delete organization	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
7c305a3a-4379-4ea1-a2de-b294bc34a34e	org:invite_member	Invite organization member	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
0669150b-c50c-4475-aa31-3afb4e20090e	org:remove_member	Remove organization member	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
6c992007-d1ad-46f9-8c51-8f21e48936a0	org:update_member_role	Change organization member role	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
717a1a13-310a-4b44-bc56-d9c3288b0026	buyer:read_own	Read own buyer data	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
0e01da00-6dfb-48a6-b6c5-4a39e900fbb4	buyer:update_own	Update own buyer data	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.role_permissions (role_id, permission_id) FROM stdin;
34547258-b2ab-49f4-aa33-1c40ecd2e518	652fdc71-733f-4ee5-92b4-b9e48ad8fca7
34547258-b2ab-49f4-aa33-1c40ecd2e518	7fd70902-0006-4bc5-9e51-a020ed9082e8
34547258-b2ab-49f4-aa33-1c40ecd2e518	8c146564-b7ce-424a-b40a-567beef1857e
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	17c65554-5677-465f-8a22-3f2a78bbde6c
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	4eeb91ae-393d-4abc-81a7-2544beb2164e
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	35e9947f-18d0-4cd8-9112-b548bfdffbb0
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	ca52ad81-38ad-4780-b3a1-e16c09268754
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	7c305a3a-4379-4ea1-a2de-b294bc34a34e
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	0669150b-c50c-4475-aa31-3afb4e20090e
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	6c992007-d1ad-46f9-8c51-8f21e48936a0
d1eb4059-040f-44a6-9af7-93be55fabaf5	4eeb91ae-393d-4abc-81a7-2544beb2164e
879dde1a-22d4-4843-b307-26a34e6ddb7d	717a1a13-310a-4b44-bc56-d9c3288b0026
879dde1a-22d4-4843-b307-26a34e6ddb7d	0e01da00-6dfb-48a6-b6c5-4a39e900fbb4
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.roles (id, name, description, system, role_type, created_at, updated_at) FROM stdin;
34547258-b2ab-49f4-aa33-1c40ecd2e518	super_admin	Platform Super Administrator with full access	t	global	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
d5f32dd8-7621-4fb5-89e5-4a46f5c1c6ec	read_only	Read-only user	t	global	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
879dde1a-22d4-4843-b307-26a34e6ddb7d	buyer	Default buyer role	t	global	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	org_admin	Organization administrator	t	org	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
d1eb4059-040f-44a6-9af7-93be55fabaf5	org_member	Organization member	t	org	2026-06-18 12:31:38.580339+00	2026-06-18 12:31:38.580339+00
33768fb2-defc-4a66-a295-90ff2a2d78fc	admin	Platform admin role alias	t	global	2026-06-18 12:31:40.372637+00	2026-06-18 12:31:40.372637+00
b03b0581-04a6-48a4-990d-9f73ae987dfc	content_admin	CMS content administrator	t	global	2026-06-18 12:31:40.372637+00	2026-06-18 12:31:40.372637+00
d36290b9-cc1c-4d0c-a698-335e6801126a	sales	CRM sales operator	t	global	2026-06-18 12:31:40.372637+00	2026-06-18 12:31:40.372637+00
d95fbd7e-7d38-4dfa-a231-e9e2f2090a66	support	CRM support agent	t	global	2026-06-18 12:31:40.372637+00	2026-06-18 12:31:40.372637+00
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.sessions (id, user_id, refresh_token_hash, expires_at, rotated_from, revoked, created_at) FROM stdin;
2bda9fa0-59b7-42ed-b1fc-b30a9617039d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ZcAzRhjkh8CWUbh3ZOqAoQ$wzaQvzFn4HM24uQEO2C3ch0ZZPqxwM/DW/XQD80Uxa0	2026-07-18 12:37:41.649051+00	\N	t	2026-06-18 12:37:41.651441+00
c7595e21-d569-4ffe-9b52-d1de36b5400c	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ryFteZ/BYdJxJTDi1AKw3g$D6HKVtFNZ9u0bzwHbJ/lYoM7yH5CcxuGd8xfcbMNK1g	2026-07-18 12:37:52.852918+00	2bda9fa0-59b7-42ed-b1fc-b30a9617039d	t	2026-06-18 12:37:54.342619+00
85fb1be8-b944-41b8-965b-8144715ad2fb	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$JwO2fWiQKIP7Mw32zY6oCg$J9bppzSgHqGtWAZwgnDnaFQO1rYJQQ7awGXNW+Om8Ko	2026-07-18 12:37:56.30901+00	c7595e21-d569-4ffe-9b52-d1de36b5400c	t	2026-06-18 12:37:56.675135+00
706e2190-0cdb-49f5-9d1f-0f7fc1715d02	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$zI53L8wkax3chJVSdec+cQ$NiESCzxnQUMdebcUj8e6jf/HMwHZF9ck8yCWSSxMdFk	2026-07-18 12:38:02.737915+00	85fb1be8-b944-41b8-965b-8144715ad2fb	t	2026-06-18 12:38:03.562917+00
f05834d4-a5ec-4e36-842f-90fb8a66235b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$PLDF15hdeuJGxyJUBoHoPA$ZAU2vycFWQq7Wt/FI/1ucXeo1u853XxYIj7A9EGnGlQ	2026-07-18 12:39:07.723031+00	706e2190-0cdb-49f5-9d1f-0f7fc1715d02	t	2026-06-18 12:39:08.643266+00
84141df0-6cc9-4cf3-b1f4-a09e571fda6f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$AL18Q5reJRJkaU96CExqHw$tnxycPH2/5AtAVoF3xe0PaabPUFSnrlf7d8WfGGMqJ8	2026-07-18 12:41:03.927388+00	f05834d4-a5ec-4e36-842f-90fb8a66235b	t	2026-06-18 12:41:05.984803+00
510e3397-1f56-437e-a593-a6bab52d50a2	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$JEL/3ucg/cwAWn88TeZjSQ$kX76bHvjFJJk38pKCLqhsokTwcIAhJJNQBn3hEkDojo	2026-07-18 12:41:14.790221+00	84141df0-6cc9-4cf3-b1f4-a09e571fda6f	t	2026-06-18 12:41:15.18408+00
1737e606-a3a2-43af-9c4d-6ff94ce30f70	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$04UYhaF7K1jz8/mPBQZ2qw$Z09cQTjrOHvuPSJi25QL/3Q388HSfYOJO1GGoPMWkiw	2026-07-18 12:44:16.069643+00	\N	t	2026-06-18 12:44:16.070445+00
9aafa152-84ab-404b-a5cb-724b4cb23cec	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$Djt3wcWxWPaQdJha63liTA$+lcZGD9BLBmO7xD0Pf1qtj2awSpd4D6lyXp1ShmKOWU	2026-07-18 12:44:20.166435+00	1737e606-a3a2-43af-9c4d-6ff94ce30f70	t	2026-06-18 12:44:20.293213+00
d25625d1-c56e-47ff-bd5d-7b2cd54a28a5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$AhxavpnlD6u+sTkUkrfujA$YI1z4hMWoRqFNVXA3CuNxsu8Ls4NhY6wzas2mjMFLQw	2026-07-18 12:44:06.271119+00	510e3397-1f56-437e-a593-a6bab52d50a2	t	2026-06-18 12:44:07.553319+00
633b9223-26ec-4509-b31e-199b82adec33	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$kORif6tELceMNzYSK5+eIA$rT6qRhPE36K4llKgvf6fA/Am4qURvqPRx4gxEdc2oT8	2026-07-18 12:46:34.423828+00	d25625d1-c56e-47ff-bd5d-7b2cd54a28a5	t	2026-06-18 12:46:34.827689+00
2b76fdfd-6db5-401f-9ba8-a5cc32d16066	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$PmVQiV6UCco32Sb4Sxre0g$FxqybSO4jEf3qyYDpI9qxF9jINFs9s6bZIkspmBCYbc	2026-07-18 13:09:52.936283+00	633b9223-26ec-4509-b31e-199b82adec33	t	2026-06-18 13:09:54.868251+00
bab5cb6e-200c-4954-906d-a9fc53d7c2d5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$BORNuyXr0NmOcDdf11Sirw$FvSee3jyRq2qHrXnstZf2LdurCf0Ol7DJwu+Pvg72Lw	2026-07-18 13:13:54.090759+00	2b76fdfd-6db5-401f-9ba8-a5cc32d16066	t	2026-06-18 13:13:54.181832+00
89140b0b-125b-4e50-8f10-6c6b28f35a3e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$91oWgJRFMEiJnNDkkJQ5Bg$ZNFJV1Wu0kF9L6zssT6GssIcngjP9T393D98GMUzFHU	2026-07-18 13:13:55.983468+00	bab5cb6e-200c-4954-906d-a9fc53d7c2d5	t	2026-06-18 13:13:56.198183+00
77da99b4-65aa-466b-92e2-53f6b94643b9	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$gr2MJQ7NCwYj8XUB7vFTcw$EgrlMDtiNr8cECFIOIMN9zFLKI4bMD/QEzdEj12F4ac	2026-07-18 13:14:01.801789+00	89140b0b-125b-4e50-8f10-6c6b28f35a3e	f	2026-06-18 13:14:02.473677+00
6e5edb08-db9c-4144-baf0-2250a8d17a0f	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$1s3zvpwBTs0zAfydxGhJkA$qDn5R7xnqAPmApJX5pG2b2RQeZOvYokv4XHDj63/LU8	2026-07-18 12:45:24.739231+00	9aafa152-84ab-404b-a5cb-724b4cb23cec	t	2026-06-18 12:45:24.958018+00
cb6294d5-67ec-4bba-bb1b-a77460f9dfd4	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$RVgmaWdlNHCTZKUdM5+K7w$irvALu7f0oqI1PgXrpcAarYEJG3QBfXc9QRIoDvaws4	2026-07-18 14:46:04.578547+00	6e5edb08-db9c-4144-baf0-2250a8d17a0f	t	2026-06-18 14:46:04.644572+00
334a2779-d61c-45d0-95f6-05d4528d56cb	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$4fg7Zv4nfs3z+mMlG2M0oA$Gli8z3fLXgsjinAMJlWYC7gBNVdul0WrCQ0KNniycDQ	2026-07-18 14:46:09.372047+00	cb6294d5-67ec-4bba-bb1b-a77460f9dfd4	t	2026-06-18 14:46:09.472149+00
ad160584-9afa-4ff5-868f-61922bfc622b	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$SVOjSdRz1nQqcdGVKVEfjw$2WQy4IYGj/a2RgoRWOo27L2WQjLLgvLQKe0lcx8/k0s	2026-07-18 14:46:16.131931+00	334a2779-d61c-45d0-95f6-05d4528d56cb	t	2026-06-18 14:46:16.166215+00
5b1dfa7d-adcf-46bb-a580-1176045c2967	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$xj6JfvJtM0wE929BclIeLQ$xgo52r5fpXjZBkwr7kClKzgvH9zX5m3rw20mnNW8HFI	2026-07-18 15:32:29.360409+00	60cbf538-cb39-47ff-a9db-9dd72a72c52a	t	2026-06-18 15:32:29.486039+00
27ed5235-1228-4a9a-949d-dd4158350226	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$IA0SuxFSlk1OO5DvCHf0Ag$DfeJypKerIoL+WeI7LtMPqqxjHLlOPSgdJ/WaLBpgNk	2026-07-18 15:24:44.589931+00	88becb6a-b74c-467a-a326-ccde198c6b0d	f	2026-06-18 15:24:44.910216+00
88becb6a-b74c-467a-a326-ccde198c6b0d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$1h0MVMbBnisA1sxOEm6QuQ$pv52RWgSm5kIGBMFocmTJsotU/tXpA7NmG1+JyLcyow	2026-07-18 15:24:38.018155+00	\N	t	2026-06-18 15:24:38.019716+00
b01f6147-270b-466f-b9f1-990c68bd9127	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$8fqZeZH6xntnLN27kVvtRw$hXq6n4SlFdwogbVDXUceGSMjqOSHXMJDljVXcGckdXQ	2026-07-18 15:24:44.806679+00	88becb6a-b74c-467a-a326-ccde198c6b0d	t	2026-06-18 15:24:45.213901+00
22c796f8-1cab-4e23-be44-6401184c16d6	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$pu6Rn1y4F/nyPmtH7i9cmg$H4Yvw2ASHExlHeDDflGZJFmlBoa+RRaeBTy7f3GszL8	2026-07-18 14:46:29.18544+00	ad160584-9afa-4ff5-868f-61922bfc622b	t	2026-06-18 14:46:29.260071+00
2be0d6d2-c4bf-4b25-9a5d-4709cc86c596	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$bHQExwiRSB5vou4Q8B4wpg$CwW4HDiYvikdXNWBxX/cK9rYZBt9D2ONcetUocpRtDc	2026-07-18 15:26:45.99079+00	22c796f8-1cab-4e23-be44-6401184c16d6	t	2026-06-18 15:26:46.030316+00
c0d00fa2-c329-48c1-a203-f47e30e55b82	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$nLnKD6pQ7M1cZgeF1qD8JA$O114Tqzt7XPzlTuzyVbwR5Z5j23N2zyGktOawwYGUxQ	2026-07-18 15:26:14.823926+00	b01f6147-270b-466f-b9f1-990c68bd9127	t	2026-06-18 15:26:14.999564+00
2811c081-5354-499d-ad32-e73be7fc920e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$TABadA+IqawDEZMFkjwNqQ$KvNOS286TiJVBCqgd7xuQXyg04QkJqgr8eB75xC4qL4	2026-07-18 15:31:39.999532+00	c0d00fa2-c329-48c1-a203-f47e30e55b82	t	2026-06-18 15:31:40.366693+00
60cbf538-cb39-47ff-a9db-9dd72a72c52a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$SlBGY1eYdKuPfuVoL6C3uw$gQtmaEwjfITMQpdD51A+z3yN3mP1nU2QYFGTmgZKo3E	2026-07-18 15:32:27.450949+00	2811c081-5354-499d-ad32-e73be7fc920e	t	2026-06-18 15:32:27.57389+00
b931b21a-3848-4a26-b9cd-780f24c72a89	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$z+4igMpEfV4jEgDicl9m5g$rvg9P7PyJeegwE9UWJHAD5Emsmqpfn9XxNlWt7LZdss	2026-07-18 15:27:18.958202+00	2be0d6d2-c4bf-4b25-9a5d-4709cc86c596	t	2026-06-18 15:27:18.989735+00
fd87f58e-85d4-451a-8e69-6f09a976bba6	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$LQrT9Sw8Vm3fjtjTfPfFJA$VrvB28uZwBhujhmcaoO1P9NXjlXrIteRxFZ3kdyK6Pc	2026-07-18 16:17:43.757559+00	b931b21a-3848-4a26-b9cd-780f24c72a89	t	2026-06-18 16:17:43.870312+00
fc6896ce-b105-44d3-a658-79fe7e8b3a5a	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$OZNqputoDy/2V1Dd7u3SwA$de9alIOhIm1P/Z1wkEtHYZyy7srh7iXdkSOR9b8j1hQ	2026-07-18 16:17:58.937911+00	fd87f58e-85d4-451a-8e69-6f09a976bba6	t	2026-06-18 16:17:58.969844+00
046eeca3-4168-429c-913a-680ef1223595	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$wY7sGIOGdU+hkMdGjEwwiA$nCFVZNyPiygZ1tf41+w88psBgnT3LZZ/VEGQOP3b0ZE	2026-07-18 16:20:38.645147+00	fc6896ce-b105-44d3-a658-79fe7e8b3a5a	t	2026-06-18 16:20:38.74817+00
a4649a70-b414-4d8a-9b31-a1eeb0c0ea41	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$YfcyoxRjKKiIrK/I0f6RQw$OcOb2lU4s978SMMitDKgIPbTuDnnfBrj5QF0PT6+nX8	2026-07-18 16:21:15.949307+00	046eeca3-4168-429c-913a-680ef1223595	t	2026-06-18 16:21:16.025405+00
6cd3425f-bab7-46af-a558-b156f0682462	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$frEBBSZ+HKQNYuEB2sSyCw$4loE3GL4iMeMcfcAA4wdEVnJNTDpMB82km1OeT7dm34	2026-07-18 16:21:28.629941+00	\N	t	2026-06-18 16:21:28.630599+00
e349576e-fe88-4f5a-9f88-c270987e98c2	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$bafptMyE+HDBcmgaN/mjgA$TjcBG1jKHRjrGXsb8uNnJIvDDzvNKy1q9RDsW3+PuA4	2026-07-18 16:21:23.855142+00	a4649a70-b414-4d8a-9b31-a1eeb0c0ea41	t	2026-06-18 16:21:24.013528+00
a25a812d-a6b2-4d15-a941-0ba22c0ea29f	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$mqnM1X8R4JqpPTgtXQb5TQ$JVEciLPB94OkcnUWNq5a6EW9g7zzg/5ScHmAbyfOkP4	2026-07-18 16:21:41.852569+00	e349576e-fe88-4f5a-9f88-c270987e98c2	t	2026-06-18 16:21:41.935084+00
98195865-22dc-495f-8e14-0294dc0d3d36	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$g/J1FjVoWeYnlhJygEcHOQ$M+2hUtbxJCeQOdg2lsKJCACZKSffX6RuUyXK/BNbNqQ	2026-07-18 16:21:29.321722+00	6cd3425f-bab7-46af-a558-b156f0682462	t	2026-06-18 16:21:29.362997+00
43c09710-6715-4851-8961-fa67cbf7cd08	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$vza0jh+ZtYJK4cY3aFfsbw$Si3h5FykOJa60e5QddRcWCFwI6zNcsQDxMftJ5Nkq3Q	2026-07-18 16:05:42.470474+00	5b1dfa7d-adcf-46bb-a580-1176045c2967	t	2026-06-18 16:05:43.222881+00
b3621653-9b08-4308-88f6-81415e00b53b	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$gLd9rpJFmZhhmvtHrK0Xng$j8x8TfClzrprPYpr3JFeULVF+zbz4TB7C+CHRUVRxkM	2026-07-18 16:22:11.026585+00	a25a812d-a6b2-4d15-a941-0ba22c0ea29f	t	2026-06-18 16:22:11.120988+00
282fb927-ceec-404d-a688-3e504b6df06b	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$1RC/Tod6raw4bqZeVZV3VA$Su7uUdWFc4s0fdvKGXJVMIoC/pDEUJOYM4UPwnMkMp0	2026-07-18 16:22:30.436574+00	94a1c8f6-f4c4-42c6-9513-da4b3325c8af	t	2026-06-18 16:22:30.525142+00
08db7f2d-bbfe-44d3-b18b-f8232a2db705	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$Cx4mBFp01I4szXWCCcNq8A$S31QHa7q1CUS35hTHJQGEdWN0Eweb8htmepOu3Huiis	2026-07-18 16:23:08.648691+00	98195865-22dc-495f-8e14-0294dc0d3d36	t	2026-06-18 16:23:08.739628+00
94a1c8f6-f4c4-42c6-9513-da4b3325c8af	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$8jdkuUYt2JnZ8WH8x89rUA$EM3K2FAg/1s2ndPDqkxVwrWpfBK/LGvJDCfjbUmYyEQ	2026-07-18 16:22:19.70083+00	b3621653-9b08-4308-88f6-81415e00b53b	t	2026-06-18 16:22:19.75205+00
3b72c2f9-11f3-4c00-b6b2-fd960ab76a68	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$GK1zLteqM0RQJMAZyWCY2Q$+M/p9T3T5TrmQ9yujJGBPU876tugsIIftYvhn1V1Cdk	2026-07-18 16:22:35.447863+00	282fb927-ceec-404d-a688-3e504b6df06b	t	2026-06-18 16:22:35.530234+00
0fc0a300-4245-4f12-a277-b2378489b71e	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$vIrS57bQUPSaksNs+hljjA$VvJ3MbuNLd1tICn0zzW0HWfv6U7AhjxJIr4ETmvLdQ8	2026-07-18 16:24:28.121399+00	3b72c2f9-11f3-4c00-b6b2-fd960ab76a68	t	2026-06-18 16:24:28.230974+00
8283659b-3ac4-448f-a23f-b2f5193b6d1f	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$mFtGd4M3qecfiN8kUlzptQ$LK92JwASEATD6VmAMUyOQ5DFwK490RFuSMzD49N7+nw	2026-07-18 16:25:46.41343+00	0fc0a300-4245-4f12-a277-b2378489b71e	t	2026-06-18 16:25:46.511753+00
8883824f-bd25-4ea7-9e3d-4938b02c5cd6	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$Y9W9YHma32pga/tF4Z9i0Q$LQZrg+nY7aPqTljbpQqoFwgo7e99xTaVOkECf93wIqg	2026-07-18 16:26:16.708927+00	8283659b-3ac4-448f-a23f-b2f5193b6d1f	t	2026-06-18 16:26:16.890585+00
3ef9c0e1-c885-4c7e-a170-97f53976b89d	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$POxiWt/GS6hrlTHxsytXCw$WWKqGqtXBmiT9rYQ3TzFIAwHm3NvoFFNItBoNpmB92c	2026-07-18 16:26:19.834919+00	08db7f2d-bbfe-44d3-b18b-f8232a2db705	t	2026-06-18 16:26:20.0097+00
bc5e55ad-c959-4b88-9f42-536ce394c857	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$v+xD5Pe2QFUwl5viJhLVHA$6bBWA+ZnHI7oVGUBLhxtZ0CYbMZMC7a29P8QhWI9VHI	2026-07-18 16:26:37.870271+00	8883824f-bd25-4ea7-9e3d-4938b02c5cd6	t	2026-06-18 16:26:37.927437+00
64471e94-4a9a-4d94-b332-6a82f4181343	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$vfOpREo8Zylt+lFk0HZetQ$P70YV8K/NmeZLK8xTeB1q6oi1JSBcvHS/13vgS4/PqA	2026-07-18 16:26:54.877384+00	bc5e55ad-c959-4b88-9f42-536ce394c857	t	2026-06-18 16:26:54.998887+00
ec32b8d5-e433-43ce-b6ea-441ba0123df0	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$zdqE1nHVJLllOZeyJmMXXw$1KrR5YMoRPT03JVzS7ns75tBDb8v1v7dfkK0WrFHZj4	2026-07-18 16:26:48.493776+00	3ef9c0e1-c885-4c7e-a170-97f53976b89d	t	2026-06-18 16:26:48.697807+00
c3c7129b-194b-44d9-9a41-f0e838488a81	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$QoxeWPyydkUtQU20uR9b4Q$FpJgleUjWMysJaRoYBgSWwzfVSF72nmV1zRh7YzCqzU	2026-07-18 16:27:20.12705+00	ec32b8d5-e433-43ce-b6ea-441ba0123df0	t	2026-06-18 16:27:20.293735+00
7de05b87-92bb-42fe-96c5-d0c9b7aeadf5	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$265eUG5RsWxznXOQQnnXHQ$DLHBd8dKVFPjGClaKyp7IzhaOevx1NFl8p5VahNjkjk	2026-07-18 16:27:03.889007+00	64471e94-4a9a-4d94-b332-6a82f4181343	t	2026-06-18 16:27:03.995008+00
65a2b7d9-e990-47ba-84e7-db4815c0b72f	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$xWBQ6oPudXkpcmynfyFTrw$Owyt/Mc5huRhVIo3fVPwF96hfeL8mq29+2rVkQnxaQs	2026-07-18 16:28:53.636072+00	7de05b87-92bb-42fe-96c5-d0c9b7aeadf5	t	2026-06-18 16:28:53.885144+00
c0202064-54f3-458e-b280-37dffaa9e6b8	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$LNDEdOZ4gvmZlEJIAzJnVA$tqQ5n6Hq6ff0E+KZ4T/kG85f6EpAIo/N0LbIYGr2t3Y	2026-07-18 16:57:43.181673+00	65a2b7d9-e990-47ba-84e7-db4815c0b72f	t	2026-06-18 16:57:43.348726+00
953cfda1-1664-4009-b9fe-5e3fd39e4a37	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$bZr8faXjBd7bVNf4BvXUFw$hjI84MQeCGGLX6hKAX59KlrUqr2N7Czy5521pH1vSvo	2026-07-18 16:57:45.153241+00	c0202064-54f3-458e-b280-37dffaa9e6b8	t	2026-06-18 16:57:45.257313+00
373f163a-0b06-4709-9ee6-ef12d3e2d745	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$2cbj1TPJ1PRJfQpyrMfFDQ$DIm0ZpRooum4mI9ELgOra8yFvS8uqx0V1QZThRkiOJg	2026-07-18 16:57:51.97691+00	953cfda1-1664-4009-b9fe-5e3fd39e4a37	t	2026-06-18 16:57:52.248886+00
645c8084-a362-4458-b43d-4ea9b85090df	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$3ebFiPznrNvMjUbLkb13gg$76DGqsRQgQyZft6LIo1JclnP5ntMPqz4THRQnQQqAls	2026-07-18 17:02:37.211488+00	373f163a-0b06-4709-9ee6-ef12d3e2d745	t	2026-06-18 17:02:37.256549+00
9383627e-9a05-4e2f-bffc-43a4366fb31b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$rqPnytZJoDOOQzw2FDPHzw$8LVe7ezgMaVl05vLyQF+Sdg7Xle5NmC0Qi2TCwoeD1o	2026-07-18 17:05:51.3356+00	43c09710-6715-4851-8961-fa67cbf7cd08	t	2026-06-18 17:05:51.543925+00
6be9f67b-61c3-494c-b9e8-3810a4c35c18	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ytrwexBtoc667LU2qNorrw$HxWueLuG2QTzDWHhfLpsJ5FrnU51eKf1KUcVv1YUoX0	2026-07-18 17:08:08.715884+00	9383627e-9a05-4e2f-bffc-43a4366fb31b	t	2026-06-18 17:08:08.936003+00
07159f46-f35e-4bad-ab3a-b6780be6c53a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$/fR420j3HYddLTINY+BH5w$Adk7lHRJPwGyssljv5cFb4yrRNfTWHOO4dpCF6VxFbk	2026-07-18 17:08:57.394872+00	6be9f67b-61c3-494c-b9e8-3810a4c35c18	t	2026-06-18 17:08:57.68382+00
00b456da-452f-477b-9bb3-3f017775c023	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$BI7yo6vsGdMItXZgV1ZzAA$bItWx7f6jP/V/4aZ2yI9Vq+RXBGS+fwpspFi6AwG+xA	2026-07-18 17:12:28.179789+00	07159f46-f35e-4bad-ab3a-b6780be6c53a	t	2026-06-18 17:12:28.400734+00
f1f7bf67-3a51-4f09-bb77-11a92bd55da3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$nvK8E7dGJV71PuCQ8t4faw$x2grv+T+4KulNwPD4d/4ZLrzmluomnPVj2UOaGGk/cY	2026-07-18 17:13:12.779938+00	00b456da-452f-477b-9bb3-3f017775c023	t	2026-06-18 17:13:13.203071+00
e1d4f13f-2541-425b-a14f-ba66680f985d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$sxXUIPfYY3WsKC85NPXh0g$zV4JRlg8qEGVkl7JXjal1fdNzkf+5JpqDqyMpHB5tkI	2026-07-18 17:13:29.486883+00	f1f7bf67-3a51-4f09-bb77-11a92bd55da3	t	2026-06-18 17:13:29.906754+00
83e387ad-c31e-4e27-8ade-cd77dd656905	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$zFH7Mx7ZGT6MnDVeoEY4aQ$hl6X3T5v9d3vVgO/LS4USnFwBIsZtsxMc6C+tLGePX4	2026-07-18 17:21:53.818498+00	e1d4f13f-2541-425b-a14f-ba66680f985d	t	2026-06-18 17:21:54.32771+00
b9e2cb78-0195-45f6-867d-c1eb98656260	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$fM3JOd6LpDl6OryqFig5Ow$/tEH9upCdQXUVMdGvDMjANIPuc1/VgxEm2ph6tdR2ag	2026-07-18 17:02:59.4755+00	645c8084-a362-4458-b43d-4ea9b85090df	t	2026-06-18 17:02:59.51721+00
2e4f4f79-278c-48d0-b789-a5345b0b1df7	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$kZQN5g2IJLaWs2g2jllQSQ$au46uSjTjXlTSwztsV6HIW2/spcJVJWMGVZHtiSUptU	2026-07-18 17:30:58.109076+00	b9e2cb78-0195-45f6-867d-c1eb98656260	t	2026-06-18 17:30:58.164907+00
2ff196b7-fe71-4831-9a62-cbb6cf644ce8	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Pd18dMn2oC3vQhL1ETFSeQ$NzWNgK4FdI+gsK/oUbNGUM7x0CI25hZYpPjfmZrGG90	2026-07-18 17:30:33.269395+00	83e387ad-c31e-4e27-8ade-cd77dd656905	t	2026-06-18 17:30:35.758073+00
bf7155ba-861c-4881-8e43-b07a25fd0892	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ZEckE7PUhlIEOTDg6H80bw$qmKqGa/WaUGVpdySAyuQQhqKjlQ/hpGPDdGRROSJ17g	2026-07-18 17:31:52.749534+00	2ff196b7-fe71-4831-9a62-cbb6cf644ce8	t	2026-06-18 17:31:53.581594+00
d5b3116e-d224-4a18-a074-66713b17cb50	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$+lxy0KybHVU7YR9oYc2rag$9Fwcc9cImQW3+MkBCSw9FFCBMaGzKN+WOH68xKe5hxQ	2026-07-18 17:32:31.954008+00	bf7155ba-861c-4881-8e43-b07a25fd0892	t	2026-06-18 17:32:32.274956+00
6462663a-03e2-4fda-88d5-2663bec5b148	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$s5X3j8tNPD+p7tVjNpIEKQ$wLAU/8Tn9kvW5XMCGKEIOefFyZ8NRx9E97+Xr9L6PO0	2026-07-18 17:33:50.740721+00	d5b3116e-d224-4a18-a074-66713b17cb50	t	2026-06-18 17:33:51.010041+00
c1335f16-7f87-4e09-81b3-cd72b9958a71	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$CdCiTejcTgBZVSH66Ep7Vw$k6wCSD/RA1H9KabDWZH51RbnY3BLybtUr4WnOirJEbY	2026-07-18 18:06:39.501517+00	6462663a-03e2-4fda-88d5-2663bec5b148	t	2026-06-18 18:06:40.543646+00
8ea1aee0-5d55-40cb-983a-87e117520b37	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ymtt2PJ7rL6/i+pYO5YaAQ$3RAP1wGwJycm21p/9PNwbTCUA6qt4LtJ+Ld6jxezRS8	2026-07-18 18:12:50.90639+00	c1335f16-7f87-4e09-81b3-cd72b9958a71	t	2026-06-18 18:12:51.180945+00
5517b30e-1d27-446f-90c4-f6409ef2ba9f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$IGl4Ed/1CqMK46s8XHylxg$S5P4WhlvoBZmqiVlxDI2YZrARejloKP9Vu3D2JfYD24	2026-07-18 18:36:52.242946+00	8ea1aee0-5d55-40cb-983a-87e117520b37	t	2026-06-18 18:36:52.502477+00
9582f2bb-4640-4100-85c5-6f44609c88c2	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$gjvOxXmmYdQOggQkr0TyVA$7LlggZKa6FacXVzAgb0bb+iJmvm9MveCDfq7U4KVsps	2026-07-18 18:47:50.238216+00	5517b30e-1d27-446f-90c4-f6409ef2ba9f	t	2026-06-18 18:47:50.812688+00
e2c09594-2484-4d2e-9a48-7aa402994885	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$4OxCJPXWyu12s+PJTWravA$AMm2OIHK8AnHEdzolOwkP1du+3smoayfOTPkePTtSrY	2026-07-18 17:31:02.35049+00	2e4f4f79-278c-48d0-b789-a5345b0b1df7	t	2026-06-18 17:31:02.483438+00
4c0c5997-65d7-45a9-9948-b686ac4ea9ac	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$iiJa2z9t8QzGYNX7O9g2RQ$zrPkUFThSz6CUmdmcc/q2eFHilDbqcoMMffaJW9aPfI	2026-07-18 18:50:23.623644+00	9582f2bb-4640-4100-85c5-6f44609c88c2	t	2026-06-18 18:50:23.816464+00
cc2f317b-24e5-45fa-93cf-a77a4a1e1c50	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$eGgb556pc3iP3yXgXCFsvw$6LzRXJ4rB6QeWYUw+4/wWo4RbZSbDMqNaTD8T55n/j4	2026-07-18 19:06:50.697168+00	4c0c5997-65d7-45a9-9948-b686ac4ea9ac	t	2026-06-18 19:06:50.746788+00
0429fd68-b094-4352-8628-21f54fdb38a2	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$I0duJPp19v09OKsLJYmIiQ$vaKr56FH2AhG4T9WvwKgnE5//KujuTXzpBU4zIbEP+E	2026-07-18 18:59:42.158035+00	e2c09594-2484-4d2e-9a48-7aa402994885	t	2026-06-18 18:59:42.267187+00
6fb5637c-1463-4176-8863-da115f8439d7	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$TIBGVs/9Exuck7xS/Ba9bQ$kui9+A/kQy6E2XukmW24EYPodaxg/gzDX7goSiNtFxg	2026-07-18 16:27:23.902368+00	c3c7129b-194b-44d9-9a41-f0e838488a81	t	2026-06-18 16:27:24.083841+00
8373dd64-b2b0-4791-8b93-3767f78c07cc	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$G8W8TtYBdpoxjh/vl0yaOw$7hx7VtGDrahLO3vH/LgJaxNlDvKX/I2ENdM/SN/mDbM	2026-07-18 19:37:51.049224+00	cc2f317b-24e5-45fa-93cf-a77a4a1e1c50	t	2026-06-18 19:37:51.563215+00
5fb164e0-52a2-48ef-a278-bfedfe2101c5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$BX1OL7YF0VNs1AmjOJB9Eg$oBRO/0bcAyuTrerBhp3sx190eaJRfVqeBaxutpkwsQw	2026-07-18 19:42:08.852312+00	8373dd64-b2b0-4791-8b93-3767f78c07cc	t	2026-06-18 19:42:09.165042+00
a84d8c96-9bcb-4790-86f0-5ae215fbbde4	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$42YZI/tsFIn4MBNE7/eURQ$0il81a58iWuOsNxDm6a9fEdBd47pbFB+F5Lkthd8TQ0	2026-07-18 19:42:16.345265+00	5fb164e0-52a2-48ef-a278-bfedfe2101c5	t	2026-06-18 19:42:16.64903+00
95bbd50c-aaa3-4004-bc27-10cbbf882f87	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$k9GT7BOgSOLMHoK0zj7ZMA$SxYOKtiEwIGJrIrcds6/EN4p2KKhnhpUb4jPohUDjHQ	2026-07-18 19:42:53.072449+00	a84d8c96-9bcb-4790-86f0-5ae215fbbde4	t	2026-06-18 19:42:53.248828+00
7cedf950-05f2-4417-95e2-51ee04c9b15e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Zc7JJKKkMaTeWwd3CgXMAQ$hGE4SxNnAHCfiEZ3r6yTEhxxmX5/L/t7SqWjHsOGC14	2026-07-18 19:42:57.880264+00	95bbd50c-aaa3-4004-bc27-10cbbf882f87	t	2026-06-18 19:42:58.161329+00
16222542-de96-44bd-94df-1dc7111d6127	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$n2QCK0T4dt4wZHbMR+f7Gg$C17pVpJCkUvLpsE0PRWMnrPJyAtzXnyb7Ay8rbkt4/Y	2026-07-18 19:43:18.478941+00	7cedf950-05f2-4417-95e2-51ee04c9b15e	t	2026-06-18 19:43:18.658837+00
3f896a53-332e-48cc-8b19-c75cdd92526d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Ve6VlPU0XQGy4po+rg6Vmg$z0nyeu8cgJJw4UkVWyR2MGmeas7NAE27rj4lNbUuWPU	2026-07-18 19:44:06.162478+00	16222542-de96-44bd-94df-1dc7111d6127	t	2026-06-18 19:44:06.432356+00
ebe219c0-bd7a-4e88-b60c-9c42f18c95ff	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ZUe2uW9yHzt4Cu1dthd2jQ$gF3V8Sx/3W3okg7/QvClQuuj7LyorNzc2BrcO1XOW/U	2026-07-18 19:45:58.419228+00	3f896a53-332e-48cc-8b19-c75cdd92526d	t	2026-06-18 19:45:58.550629+00
3c69cbd6-9b99-4aae-a3c7-9447af1cf5f7	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$G9sLIEgIK//kGCU0MxZcTA$CM5/20euIFLvKD1BgmojskrHuSxfo2rEpiCwI+7Ackk	2026-07-18 19:58:11.902237+00	ebe219c0-bd7a-4e88-b60c-9c42f18c95ff	t	2026-06-18 19:58:12.198556+00
39860f0d-ca07-4ddd-be28-a446536096a6	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$52MlftxkmTlM7baiGOZxhw$tg9pEYiuxxSXneVj/3JmeuwX9SUcTCnuoWFkFNal7w4	2026-07-18 20:05:48.454218+00	3c69cbd6-9b99-4aae-a3c7-9447af1cf5f7	t	2026-06-18 20:05:48.677853+00
79da3692-bb43-4a6e-97ab-f870e968c8a7	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$5A6NBlLW7gRE59BucxDJrA$LUXoBcc1YerO+VH9sr8gQCCKiMXD2rfoUpBp46/yk9c	2026-07-18 20:08:46.865066+00	39860f0d-ca07-4ddd-be28-a446536096a6	t	2026-06-18 20:08:47.232084+00
0ab38c89-32d8-4237-a699-d007a9df4e5d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$0VuQBFZaswYhPlA/GQbqew$nmTBXq6IiFCbjytFkw8/A5YF1jbC1baHtw3UzWVo+XA	2026-07-18 20:22:06.527855+00	79da3692-bb43-4a6e-97ab-f870e968c8a7	t	2026-06-18 20:22:06.789073+00
aa747ae6-8cd3-41b2-ac13-ed98f99335f3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$XnGHPdd1vVOnvpYYzaiU4A$EVW6CgLdJ3ydxntaIrRl7pjAYRRIUctX4hxLqQTbnmg	2026-07-18 20:28:06.365088+00	0ab38c89-32d8-4237-a699-d007a9df4e5d	t	2026-06-18 20:28:06.592379+00
7e11ad53-dd0d-4b54-b11c-781c171152d8	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$jIzozKLfv8M6zJgXC80P3Q$nGD4+0GAbNDj9z9xIHxPRrJH0wIb1Y5zSYRwwoWp2Y8	2026-07-18 20:38:50.737414+00	aa747ae6-8cd3-41b2-ac13-ed98f99335f3	t	2026-06-18 20:38:50.997463+00
fa105eed-ff50-41d2-aa93-350848339e11	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$T6RsaFINyagldXbiSiGqEQ$pEkm+BPwYSe88Fcik1jeXhZM7HENOfDa4MMYorpBVE4	2026-07-18 20:41:26.294947+00	7e11ad53-dd0d-4b54-b11c-781c171152d8	t	2026-06-18 20:41:26.474537+00
f01e1ae2-c0fd-4e5c-a533-57e8d9eb901a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$/9iA+FBek+QMUHXgIXnWNQ$5TRaVxFGXNh9akDUFwt11z/sy336nJNZ8n31vs5lP5E	2026-07-18 20:53:23.689682+00	fa105eed-ff50-41d2-aa93-350848339e11	t	2026-06-18 20:53:27.631872+00
ede1f786-b149-42bc-aca4-9886b001bc7c	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$UiUdoB5DS0FFXvTjYXgVZQ$CONv2TuWU26EeFALok1Uti9Nw3WJ1k/3HzkwRrr7dUs	2026-07-18 20:53:47.737296+00	f01e1ae2-c0fd-4e5c-a533-57e8d9eb901a	t	2026-06-18 20:53:57.626668+00
17d1026c-4948-4abf-97b2-23900b815e07	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$2yy70/dCj8gwRx+j/pyvVQ$SGkkaUZRLyZNOWd9RJw+VC3gH8EE0tdrT7zTtdjMOEI	2026-07-18 21:00:17.90583+00	ede1f786-b149-42bc-aca4-9886b001bc7c	t	2026-06-18 21:00:18.125898+00
45aa7e5a-2c2b-4803-b56d-acf099872e2a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$kr3wCfnmKwpccRyuBmaRgg$/AdoD5kx7WvMnr4HgKsevVP+hKkEIhzFRXYIUqQ8tJY	2026-07-18 21:05:37.772086+00	17d1026c-4948-4abf-97b2-23900b815e07	t	2026-06-18 21:05:37.973424+00
48d5caa8-b2cb-426e-9adb-5457915b6317	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$FCCZt5Uaagnc1BnyEPDLfA$us7N9rLifwV+TVaP1zJQisZgXzSjS04jOKsHCfRLb1I	2026-07-18 21:41:53.532002+00	45aa7e5a-2c2b-4803-b56d-acf099872e2a	t	2026-06-18 21:41:55.399043+00
003f35b4-0275-4510-92fe-fdc04f635993	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$vWW5tk0B9Zt01hSfw13wxA$VKLOQ3ddLim1x1HAuFDeeAz9UDm5/THkYUdkK9dQ4+c	2026-07-18 20:57:29.85862+00	0429fd68-b094-4352-8628-21f54fdb38a2	t	2026-06-18 20:57:30.613768+00
9f61d63f-e882-4e3f-95bc-e62f24f5ef22	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$pV19j4YoYruL7ckdONntNw$osU7I3dde/AMqN0+yqoRFaDghBKzE1/Nctt8JUd8iD4	2026-07-18 22:00:55.482353+00	48d5caa8-b2cb-426e-9adb-5457915b6317	t	2026-06-18 22:00:57.250077+00
fd8459ef-a543-4ade-bf8a-c0b1bb3c5d3d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$FPd9zOl96wHpD2SJJA/ocQ$V9+BKwcyX3opSYegYCvhTCj5NinLoMH5WhNuslRjeZo	2026-07-18 22:05:50.090525+00	9f61d63f-e882-4e3f-95bc-e62f24f5ef22	t	2026-06-18 22:05:50.306474+00
0e60f020-6c17-4b69-afc9-ec924dc2d463	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$S8f/q8nAfHSlrRnW/KGd9Q$J4k36gUUGNIoT+KSgk2sO2D5NPRbMLI0RKp15NF8eNo	2026-07-18 22:42:51.658591+00	fd8459ef-a543-4ade-bf8a-c0b1bb3c5d3d	t	2026-06-18 22:42:53.268819+00
bde148f4-37b3-4763-a7ed-c4bb50c8ace1	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$LyJ3Kbpl4/8Gbf2z5CzuJg$7dMF+qom3Z3nY/a395XbFY7ythU33EtQTtTz/5vSlD0	2026-07-18 23:01:49.906904+00	0e60f020-6c17-4b69-afc9-ec924dc2d463	t	2026-06-18 23:01:50.040602+00
fae7b1d9-d3a7-4d79-b8b0-e9ff4b0a2cee	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$t/vR9kQ7LPIyJWb69DPlvw$o5r4eGho8LY3FhiH0RzZ2c424cxckPTjDb1sufBxle0	2026-07-18 22:03:51.446034+00	003f35b4-0275-4510-92fe-fdc04f635993	t	2026-06-18 22:03:51.983568+00
8b024649-b9a5-4b38-b616-afd9aaa808b0	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$OsHLC0w8LSlJ1OAYSBs9bQ$hAJV5zC2zVkXpVHznlcNQgVRiYHaSV6tyeabU40mr/4	2026-07-18 23:06:50.011505+00	bde148f4-37b3-4763-a7ed-c4bb50c8ace1	t	2026-06-18 23:06:50.144956+00
d8f0a85e-a899-4629-9299-d20427c1336a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Ltg9gp1CIIBxaRxZY0ygVw$phuJg5lvrV6xYWzzGrLBjN7JA+3sDrj7HRxTVDOGbD4	2026-07-18 23:21:08.694367+00	8b024649-b9a5-4b38-b616-afd9aaa808b0	t	2026-06-18 23:21:09.106337+00
e80cc9fb-3df8-447c-8d7b-1220b0a7e5d3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$sKGQrfAkPRyjm559tp1txg$pAkspPi49VvwgtJyrp0Xw1IhTH2zqw5VAH9STGlZwCQ	2026-07-18 23:24:39.751384+00	d8f0a85e-a899-4629-9299-d20427c1336a	t	2026-06-18 23:24:39.938356+00
aa4d4ae9-4185-4431-bf11-5b85df5f530b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$krOmrtCc0VAEtrYhQmP6zQ$Iq6Xy44b+KL4e6ChreP1X8JdDX3kwPBpM8bhUc02sNU	2026-07-18 23:32:13.210099+00	e80cc9fb-3df8-447c-8d7b-1220b0a7e5d3	t	2026-06-18 23:32:13.678324+00
28465de5-bcbb-496c-b3d0-d63a85b7accd	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$DTLGJRLZLhk19AWxLS02gQ$vAScu4RlVGc8VIpspz6v5cWIXHXUALdX6R29QQ2aJhk	2026-07-18 23:32:22.51416+00	aa4d4ae9-4185-4431-bf11-5b85df5f530b	t	2026-06-18 23:32:22.697257+00
dc220f72-2087-4678-837b-97dbe2fee085	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$IM1MBhqHUaF4/73hVIOLwQ$yqbzwTETE/ypGLYIdUgBSCWUwfBtaYww2Lv/tOabb04	2026-07-18 23:33:44.579511+00	28465de5-bcbb-496c-b3d0-d63a85b7accd	t	2026-06-18 23:33:44.916541+00
2088e4e9-3333-407c-871d-c44868c9d757	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$3UbNbZWgrCC01fHDj9peZA$toVeqdFuD4s0iPeNub3MWXhFNCsL+DZG2TIdGyAkhGs	2026-07-18 23:43:50.478227+00	dc220f72-2087-4678-837b-97dbe2fee085	t	2026-06-18 23:43:50.527804+00
c318d645-3222-4fa1-82f5-80c4e41da506	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$iN1LhTSso6ci7vLftQw8TQ$LLRE/9V6YLNcjfaQ92pJX8zJLGc0HfXg+fFJJhi5wTU	2026-07-18 23:49:33.251793+00	2088e4e9-3333-407c-871d-c44868c9d757	t	2026-06-18 23:49:33.373341+00
12cc7062-2348-4b90-9c39-975fb1946014	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$2SluKb8GuLCm2z/9EYemNg$lpQqKlIOxcHP11MCD/D2On4x5dUy4bfqZQqieH0UT4o	2026-07-18 23:49:53.666048+00	c318d645-3222-4fa1-82f5-80c4e41da506	t	2026-06-18 23:49:53.947498+00
1a00d3d9-3c54-4033-82d1-24b0008622c0	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$pT/dQXsOiXB/TV90pCeyfQ$Q66YSi0hT2mTXHG485iiEyGL8WJAOwBh/X7TnwGhUlg	2026-07-18 23:52:37.481865+00	12cc7062-2348-4b90-9c39-975fb1946014	t	2026-06-18 23:52:37.944733+00
1addfde5-bfde-4691-b528-cc1c43e62b9d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Sjo+JKdhJlzwigxBlpI4oA$8f7pFem8++Im+DVkfAtSW9QH7mrmgekw3fpnXoYwacs	2026-07-18 23:55:47.420232+00	1a00d3d9-3c54-4033-82d1-24b0008622c0	t	2026-06-18 23:55:47.620447+00
5127e985-4ee7-4e90-90c9-fb50c01addd8	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$mFZ1znoKovD60vU5zmPgYg$wKNIWd1/nwjxhoF9b0GZI8mUGSGsbIc+Iyme8a4n3yc	2026-07-18 23:18:58.60571+00	fae7b1d9-d3a7-4d79-b8b0-e9ff4b0a2cee	t	2026-06-18 23:18:58.825549+00
e0f920f2-e6f7-47bd-b2a0-34b92d79c7c3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$tJtY0YcieZkVzoir/BRPdA$k0MfmeRDnMt7EHThRNY9vebkjD/jFp+8RYCWDyRdq9Y	2026-07-19 00:01:50.292147+00	1addfde5-bfde-4691-b528-cc1c43e62b9d	t	2026-06-19 00:01:51.36993+00
39ffefac-1bfb-4936-ad51-ff852fa753ec	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	$argon2id$v=19$m=19456,t=2,p=1$bOfTKLO2ktcacvWh/mYHPw$3TU2lsqdaR9M6tbMkXFUdzpEzgBx0nvOXrD8uWo/h5o	2026-07-19 00:01:59.601229+00	\N	t	2026-06-19 00:01:59.602742+00
09eed428-536a-450a-a6af-85a54319a3f6	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	$argon2id$v=19$m=19456,t=2,p=1$kiRGcL/VSTski+/IrpK3ZA$atbPIJrogmZds3aT+h5EqQqZZEnwqPj/UKKu0Z/zZOc	2026-07-19 00:02:01.000498+00	39ffefac-1bfb-4936-ad51-ff852fa753ec	f	2026-06-19 00:02:01.36695+00
d619f6c0-da36-4725-80c0-4b87271eb3dc	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$tpAmKxIQcdCnMq/IOd9/UA$iE6sOi+jUnm8l7sZfIfgXwGCx8iaICqp/RMBfP0+P8I	2026-07-19 00:02:17.671194+00	5127e985-4ee7-4e90-90c9-fb50c01addd8	t	2026-06-19 00:02:17.70429+00
ce3dca1b-88ba-43bc-ba92-ec3fb1ef35c5	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$sYTkgFXLr34LidU5qKWSww$s2D1XZckJpciIaFK+S5us+anMSnzZJ/DGzR3NTqtWyg	2026-07-19 00:04:47.877128+00	d619f6c0-da36-4725-80c0-4b87271eb3dc	t	2026-06-19 00:04:48.04176+00
2db7d75f-8b5d-4264-bb80-23c0caceb82d	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$cUIKWI0hXpVJlkCpKhz68w$8M4rnYZKktSHKS2JAS9CJ3+TWZ3DynaMW4UpeBtAK0w	2026-07-19 00:06:33.361384+00	ce3dca1b-88ba-43bc-ba92-ec3fb1ef35c5	t	2026-06-19 00:06:33.457981+00
12fbd942-85fc-471d-be5a-ff6af89af9ec	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$di8D+k5J9hnbbi5s9toV8g$6UflcsERR4ApXICbpeHqwH/hnw5fPzlowae3lChSMts	2026-07-19 00:06:51.321312+00	2db7d75f-8b5d-4264-bb80-23c0caceb82d	t	2026-06-19 00:06:51.421347+00
be5e701f-64f6-4a2e-9aef-0094cc84cb64	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$CCNBjtR25H4acO5beRJsNw$6i5kAXiK6CyLAAAYqJ3sUBD4snFFXYZ7jQ48mqGYyxw	2026-07-19 00:07:23.204867+00	12fbd942-85fc-471d-be5a-ff6af89af9ec	t	2026-06-19 00:07:23.240623+00
f7ff61d4-2cb4-4b89-bf5e-1c0652e109b5	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$yopmUP9bWGsVwLPpym/ASA$G6FhhjBFnYpTZkPpFOUVq92nauoKPRkgB86MVMni2pQ	2026-07-19 00:07:25.609334+00	be5e701f-64f6-4a2e-9aef-0094cc84cb64	t	2026-06-19 00:07:25.745795+00
c70e0abe-2bdc-4445-a753-39e05cead5d3	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$ct5rtVTvzA36VOaKShRP4w$UvWmnUkhKCgzqi8dt02u9wVd6qwLY40oo8TqmAUeOUA	2026-07-19 00:07:34.607543+00	f7ff61d4-2cb4-4b89-bf5e-1c0652e109b5	t	2026-06-19 00:07:34.717714+00
5b498ed6-6b33-4861-994c-e2786d8d6242	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$hS2M7JViX89ynQWQkLp7xA$Uz1hR7h4cW75PGFaQZpMMt7x7QtnJys11VSdnPWwqUU	2026-07-19 00:08:17.953583+00	c70e0abe-2bdc-4445-a753-39e05cead5d3	t	2026-06-19 00:08:18.054013+00
45c09062-6336-4c64-abeb-2cd2416c25b6	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$EkWqJnWO4+jiLfOVmOBV0A$UcYBc3t8jWg2aDwigfDdlEVVDhOTkEOcXX6nFSwTi0A	2026-07-19 00:02:30.068487+00	e0f920f2-e6f7-47bd-b2a0-34b92d79c7c3	t	2026-06-19 00:02:30.292767+00
76334cf1-ca36-49c5-bc6c-46debaed9972	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$MGgBAmyWqZGQp5AsS1g7ug$+tTwn2KzKJjMuvJegxsDmNpyX7Tzo0wuXgLhOT9Into	2026-07-19 00:11:07.13157+00	45c09062-6336-4c64-abeb-2cd2416c25b6	t	2026-06-19 00:11:07.483578+00
240bc359-2bf7-418e-8793-267c10ef80f5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$p/ynGDQ+youOg2yuJOcfsA$lLgAvVWAH1zW0GcQ6R+rrYcCNxFs79TMZiAPVeU5Vbs	2026-07-19 00:11:19.98533+00	76334cf1-ca36-49c5-bc6c-46debaed9972	t	2026-06-19 00:11:20.562422+00
fca2bf4b-5e6b-4671-bfa7-624f2b0a2673	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$cW/ERB4P9V3pPJHn8b/oow$nMLRf5AsH/wr8GD7kKw3bpnoDyBFEzQKi7xfc17NN5U	2026-07-19 00:13:09.685569+00	240bc359-2bf7-418e-8793-267c10ef80f5	t	2026-06-19 00:13:09.986243+00
c8375093-bf93-4898-b969-f38e968af397	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Dvhs4jGRA0W9XQAM6BjH+Q$o6iGTveGMYu9Ei3X8QwhEV+EfvKVwLMqTkcKXkxVdCQ	2026-07-19 00:14:56.202388+00	fca2bf4b-5e6b-4671-bfa7-624f2b0a2673	t	2026-06-19 00:14:56.487043+00
988e6448-146d-4475-8553-4b2df2aa7ad3	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$A6F85Nm47vnChYBmrd8IBA$bizKYeL8D0TZHlnzZFOaOdomNNDLC87ghqhR2GKiN5o	2026-07-19 00:09:02.324941+00	5b498ed6-6b33-4861-994c-e2786d8d6242	t	2026-06-19 00:09:02.50679+00
66829ad1-00bf-40ab-acd6-84ea08ebfbcc	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$pHVwmQZhmGmXmbeXh8MGsw$o11RmqEjQf8QPi9NOfecXzKZ6k+62vPOfTnKEPTHkPc	2026-07-19 00:15:21.609597+00	c8375093-bf93-4898-b969-f38e968af397	t	2026-06-19 00:15:22.387306+00
c6dcf730-c03b-4d3f-a435-6891f8a45f0e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$juI0GYSnHMagINhx+Pmg6g$BkZlnI3HVYGFK/puY0/spCylh9acoguyj70q9C5zFug	2026-07-19 00:44:52.085871+00	66829ad1-00bf-40ab-acd6-84ea08ebfbcc	t	2026-06-19 00:44:52.409873+00
ca61cdc6-d5da-4978-b5df-6e2ff68c68fc	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$J1E3rBrN2eaEZjQr0AhtPg$/DqlXYW5DEII6Mwg+2pXowFT5b07dx5BoBoEUODxe9k	2026-07-19 00:45:59.287926+00	c6dcf730-c03b-4d3f-a435-6891f8a45f0e	t	2026-06-19 00:45:59.518074+00
e9756915-c37d-4625-8ec8-b619645badc7	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ihuH33zTl52/AiHUOwZsyA$ei5HhpfK/ghxs32xJqTvtvrOuRJN6KlrIZpe9O4o8no	2026-07-19 00:46:01.19211+00	ca61cdc6-d5da-4978-b5df-6e2ff68c68fc	t	2026-06-19 00:46:02.002909+00
ac2320ce-1466-4909-8fa6-7340ebf09c43	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$cfcSKfqENRPqFGJeI/OkBg$WM+20MR9EuQpHrcqmpQqE53DqhiLHql7mu1vZCO9gSA	2026-07-19 00:16:47.168906+00	988e6448-146d-4475-8553-4b2df2aa7ad3	t	2026-06-19 00:16:47.287111+00
0193f6e0-243d-4ade-ac9b-0a4a8efb58ee	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$ZZQsQP4Lrc7giHz2tasLoQ$e7M6TIuJ/ABFJPY1w3NaG99L+ELwoT8J3nXwDSigK6U	2026-07-19 00:54:13.932686+00	ac2320ce-1466-4909-8fa6-7340ebf09c43	t	2026-06-19 00:54:13.969597+00
35bd5e10-0b88-425d-bed7-69afb8ae0075	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$3HO8VGciwerd/5+MD/8d/w$gDfsWD21PweG3xe1D5XBEQ4xmMhGVVGzQK7eYu2xTd0	2026-07-19 00:54:27.312154+00	0193f6e0-243d-4ade-ac9b-0a4a8efb58ee	t	2026-06-19 00:54:27.346399+00
9e3c0909-6f4d-47b0-bc29-d72823066f4f	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$GB/LXU5mr6Vj5If6LpQ55g$8nMAfDIKvth8HAa4IxxJz4sKlqi5Zy+lxB8uhgCG/0k	2026-07-19 00:54:33.329013+00	35bd5e10-0b88-425d-bed7-69afb8ae0075	t	2026-06-19 00:54:33.380287+00
4f97560f-bd34-4248-ae0d-d140f88075bd	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$uomHwZRB2Zi4Eax7d9XbuQ$Qha22098cu2EE9hZmYLlHRcvPlwpvy/l5v2kR0tVguo	2026-07-19 00:54:41.654116+00	9e3c0909-6f4d-47b0-bc29-d72823066f4f	t	2026-06-19 00:54:41.778492+00
2c035278-dc94-4547-9f6d-4dfe97ca040b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$bS9uSO4DuepKq0W7cUZ9XQ$lH8kjiX91J3Y3ITI8WLxdMLQkFydmKKFgzYGdqkZ2ag	2026-07-19 00:46:38.984889+00	e9756915-c37d-4625-8ec8-b619645badc7	t	2026-06-19 00:46:39.480586+00
3d2f11e8-1177-4a53-b436-002b374db307	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$+XQfe6o2PvQUOBaZW33dDg$lUve+WbaoQqGbNiRiP82W7SYS9tu/8TVLgMpMP9wJtU	2026-07-19 00:55:49.280727+00	2c035278-dc94-4547-9f6d-4dfe97ca040b	t	2026-06-19 00:55:49.353413+00
51bd32f3-a449-4814-ae7e-48579c246c4a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$6/mMaR9yhQKWcM2Jx1V/Fw$BDVb3rFIWZDNFDvXXDEEZl3oMW6lAmMg7fQ+xZQPhTg	2026-07-19 01:11:49.238452+00	3d2f11e8-1177-4a53-b436-002b374db307	t	2026-06-19 01:11:49.265765+00
a64307c7-6ec5-4f15-9e5b-4c61c8493950	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$UIq/oM4+BQAlxQowdeBVgg$1jDCS+jKIlTFQWY8+AvAHwlIFgY1XZN34YnVTVaMrVo	2026-07-19 01:45:49.309696+00	51bd32f3-a449-4814-ae7e-48579c246c4a	t	2026-06-19 01:45:49.375774+00
19640f3a-8389-4e43-a2f4-1ca46e2d7e29	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Wr4ZCxaYTJXAVAs5YL2zpA$LRqBvbJ0bZp1OgAeLhdYEQzj7JiA+AP7anIgWVV4h+o	2026-07-19 01:46:40.054706+00	a64307c7-6ec5-4f15-9e5b-4c61c8493950	t	2026-06-19 01:46:40.093254+00
3ab03375-660f-4e8b-b681-6f73c1195d37	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$+zcRbI5rAikO4VYP1PSGUw$BgWwPbMzMBbn6/TMaJGnBV9WNGwXo0Hava/1yhdy5fU	2026-07-19 01:55:49.218654+00	19640f3a-8389-4e43-a2f4-1ca46e2d7e29	t	2026-06-19 01:55:49.306369+00
0c26af27-ba09-47a1-96a6-667181b833a7	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$NgauYB/4R4TQkW7NqrbwwQ$RL5QarYvD2R2TtkDk13x2EWTHpJIoSviv+Oi8innTjc	2026-07-19 02:11:49.183381+00	3ab03375-660f-4e8b-b681-6f73c1195d37	t	2026-06-19 02:11:49.243301+00
268fd58d-78ad-435e-92cd-d9682cebfa57	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Jc/wtcBTWmN/ljEO4ANMTw$8NCrqRkkOIGJcLk9ByxZ7bFhzl6o2l8ZgV0O8+ppjsU	2026-07-19 02:45:49.223484+00	0c26af27-ba09-47a1-96a6-667181b833a7	t	2026-06-19 02:45:49.271132+00
f13fbaf8-58ac-469d-bba2-05d5b2902620	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$x40mV8ZD/5tWaKM5ITV0jA$DH5Zg+vvKWjS9/JOkkgKaC3blsReiiPkvho8zzyPh8s	2026-07-19 02:46:40.303418+00	268fd58d-78ad-435e-92cd-d9682cebfa57	t	2026-06-19 02:46:40.367389+00
6da56863-d28d-4c9e-b0a1-b37d8eee139f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$AO4zVfyZDSWo44UvJxn52Q$fbreTtdvTqxdJk/xAB39RGRrQiWPSw1bbktbg8njoxM	2026-07-19 02:55:49.190307+00	f13fbaf8-58ac-469d-bba2-05d5b2902620	t	2026-06-19 02:55:49.222338+00
cb3d58e7-90bd-42b9-8d80-b8bd05ae8b23	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$OH89Yhp6vFUEXJDGDrXwUQ$4A7z+BBmgFqQfWUNInrOv2NPKqkyw1yeaJicUU8/Tp4	2026-07-19 03:11:49.234252+00	6da56863-d28d-4c9e-b0a1-b37d8eee139f	t	2026-06-19 03:11:49.276023+00
0996377d-4219-4b84-9982-e7046d21cdcf	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$08uI+edy1BP4TyEwW2so0g$TXTicA8T12gocP9gi86mAaJUMG2Y1ixCAmKlFChN2LM	2026-07-19 03:45:51.343511+00	cb3d58e7-90bd-42b9-8d80-b8bd05ae8b23	t	2026-06-19 03:45:51.425159+00
db7be05c-0a15-4446-ada9-b2ba01c74ace	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$C6hHslDZoFLhoa/fVjL1dw$NcHtTT5fqZC/zXx2nid5oH7KRuk8rqYRWLSbG0Q0xrU	2026-07-19 03:46:40.615152+00	0996377d-4219-4b84-9982-e7046d21cdcf	t	2026-06-19 03:46:40.709932+00
aaf047fb-45d3-4531-9d71-2ece994e252e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$zS5Mp5O+SW71Ka73RFCSlQ$+Mwpw4rMigv7obyABx6gSb/+lIsNzjrpGSbmMKqoXAI	2026-07-19 03:50:37.296657+00	db7be05c-0a15-4446-ada9-b2ba01c74ace	t	2026-06-19 03:50:37.524314+00
d7927665-1624-474f-b836-fea304dc8105	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$3sbDB/ifL47Eh3/sDFYwYw$L16FrLSiGrItwdtZDxxIH1SUlpkott8YoIpcl50mtFg	2026-07-19 00:54:51.313916+00	4f97560f-bd34-4248-ae0d-d140f88075bd	t	2026-06-19 00:54:51.382199+00
2a214b87-fce0-40a7-9a68-d0b202a6bffd	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$t3TTXQQv6n2gZ/w5/GOfYw$KnnCVXryhMtmTf3khmcUb4q1HZEp6Jf+46Nk9TXPyAY	2026-07-19 03:55:49.377572+00	aaf047fb-45d3-4531-9d71-2ece994e252e	t	2026-06-19 03:55:49.468124+00
aedab471-dbb5-4c90-a043-26beff0fc4de	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$G+6pV1zAnBDAjLUpOSQCrA$dAgseL4Y1I9Lan91unIoaz/9TLULeadel+E0ns7egDU	2026-07-19 03:59:55.116124+00	2a214b87-fce0-40a7-9a68-d0b202a6bffd	t	2026-06-19 03:59:55.179665+00
995dc65d-302d-4813-9061-78032b3d1d23	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$OSJPq4ka5UiSujcHY5Wnww$pDaxZD/1/4jH67apu7Yy5OOINOtinFd/ImGu6edFujs	2026-07-19 04:05:27.453534+00	aedab471-dbb5-4c90-a043-26beff0fc4de	t	2026-06-19 04:05:27.625722+00
272dacde-6986-415d-bf1e-1d301b8ecbf6	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$/F1tKocXZKAEp3UmSsl+5Q$6CEYu2o8Sal5RmrGKmQWEt1F+QblZNsSW/VWjcV3P/I	2026-07-19 04:09:18.843277+00	995dc65d-302d-4813-9061-78032b3d1d23	t	2026-06-19 04:09:18.933134+00
86f45b46-cbcb-42ed-9459-0c23eb608548	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$bGfzoSbacXJnCH7tp541pA$Bzr6EothRqM0L233HvIm2rUw58DhIz7CXatZ+yoU5sU	2026-07-19 04:20:55.783277+00	272dacde-6986-415d-bf1e-1d301b8ecbf6	t	2026-06-19 04:20:55.950888+00
8cb34808-d4b7-4771-a673-6b7c350217cd	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$WbN1qjeLACjFtc/ThdPDKQ$aKKcE9bI3xdGUQlu6XQoA3NXC8FVzAzKbuTXWE8tOhM	2026-07-19 04:21:21.699903+00	86f45b46-cbcb-42ed-9459-0c23eb608548	t	2026-06-19 04:21:23.258686+00
6427f1d0-5d93-47d6-a2a3-7a2de631f007	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$8Ocjaao231opnvFQEip1tQ$mR/xEMWHolCf4EUqiMaVItIeItYrfDVxmUyPENkV58M	2026-07-19 04:25:19.429676+00	8cb34808-d4b7-4771-a673-6b7c350217cd	t	2026-06-19 04:25:19.630489+00
85963e39-6fd9-4cd6-a176-0207c9afd740	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$l+pvgIYz901Qk6K1BmK8sQ$xkW8HT7YobSjfyKMSgTTc3p+SQwDAOhloOlOBv06ob0	2026-07-19 04:25:23.964058+00	6427f1d0-5d93-47d6-a2a3-7a2de631f007	t	2026-06-19 04:25:25.545625+00
7a6eb8f8-cd61-49b8-8489-aacf5aaa4043	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$1fhIlPdkX8MOYv+ZRKOniw$x3M/p4eCcwNs3f0etuwXolB4Cn5H2B4wbDFkmLlsNGY	2026-07-19 04:27:16.804076+00	85963e39-6fd9-4cd6-a176-0207c9afd740	t	2026-06-19 04:27:18.527374+00
34d407c6-9ce5-4ed4-ad40-0f05345fe243	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$/HOVDzp6MA5msK3GYPZg0A$kF9EWEB978l76+GGOa6CDMUlO30ap61iGWx1+tqBKQw	2026-07-19 04:30:33.316604+00	7a6eb8f8-cd61-49b8-8489-aacf5aaa4043	t	2026-06-19 04:30:34.110566+00
8e49f085-32db-4b92-bda1-75b77716b9fb	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$1s2zSTH8+ejfvEgLVn1T4A$Jlsx3qZlLJljnLjoyF9wn1EuLymYCueJjVFHLl8Tkbw	2026-07-19 05:03:59.432434+00	34d407c6-9ce5-4ed4-ad40-0f05345fe243	t	2026-06-19 05:04:02.56704+00
09f46666-76fd-44cb-bce6-35ceb21a550f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$NDsBgtpZKls4vNNjEsoS+A$RxJiwb4G1/dn8jWBaPWdY0GFkZ45emAENd2ZqET2WvU	2026-07-19 05:12:14.930829+00	8e49f085-32db-4b92-bda1-75b77716b9fb	t	2026-06-19 05:12:16.338997+00
6d95ba3c-e30f-40a4-88b0-8b428353bdb3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$U/g1Rcd/PU49cfYIxbDRyw$VeY3X3qV72UXcQ6BF+fZ27tNHjnCVLwZGWkY2AP+GIE	2026-07-19 05:12:21.748714+00	09f46666-76fd-44cb-bce6-35ceb21a550f	t	2026-06-19 05:12:22.145693+00
a1bbf2b2-847f-4714-9fc6-750fc62e2e4f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$enkflEd4oFDsbOuj+wcMFQ$Uma7kO+hjBn0K2H11rb3d/50y5Q82IzetgN1EszdJsQ	2026-07-19 05:12:50.5468+00	6d95ba3c-e30f-40a4-88b0-8b428353bdb3	t	2026-06-19 05:12:50.823554+00
285fd41a-ddc1-4bbb-bd12-31044bfc2628	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ytNPhAEjjA091Uoui6nPMw$iheO6t6ZaqwE61IolTxyqvlzoKNAL1e5YvRUkN2TTMU	2026-07-19 05:14:04.434291+00	a1bbf2b2-847f-4714-9fc6-750fc62e2e4f	t	2026-06-19 05:14:04.822347+00
8df2448f-c681-4ae5-9cdc-b107d016a1f3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$dT4BZurHuycAnMGrffh3Vw$2eq57rYfrSEvwcYUf6C9K0ni9XQaLU+vFrH1yhek31k	2026-07-19 06:14:07.490537+00	285fd41a-ddc1-4bbb-bd12-31044bfc2628	t	2026-06-19 06:14:07.646216+00
bd9fae7a-2f95-421a-9f08-1fb6f1355984	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$B2GCAENNwvkxUmoBaNDK9Q$gIBc2CFg5kHDS71CIyWe0oUR7/cJYzDKo119rY4Wc/I	2026-07-19 06:25:19.453403+00	8df2448f-c681-4ae5-9cdc-b107d016a1f3	t	2026-06-19 06:25:19.834128+00
ee473f95-c879-4260-a9f7-28318f7c1f29	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$mD6S4qaTi0goKIwkt9MYog$Qg4ygGB6BVJjaIaEI6LtJWjfsF0wInZ/yga7L0Y314o	2026-07-19 06:42:50.834784+00	bd9fae7a-2f95-421a-9f08-1fb6f1355984	t	2026-06-19 06:42:56.131911+00
7f4e2592-2122-4b43-9817-76bad418d330	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$N2Pq11SUwdtFL9EDHGTZLw$v8l0qjIQWlNCHHfcGGHnPMOFhYaskvZUfUd0O5k2bec	2026-07-19 06:44:15.829396+00	ee473f95-c879-4260-a9f7-28318f7c1f29	f	2026-06-19 06:44:23.316655+00
40ea9443-8bd1-4424-a864-9a5656c9b6d0	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$dyibU6d3Dr/D3oN6wOi+sA$T6MRbOoLF9JnrCFNJaoFxrdeieRFqPu4glrZ/Jlj0eM	2026-07-19 07:19:50.471777+00	\N	t	2026-06-19 07:19:50.517403+00
a51d4181-eadb-4d23-8285-84914d53de98	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$sTHiYKGcDDLRT0E8sDjeJg$iBrQHIs9tp14UOFjb+eWxKUnw+wa4k4fxXAKq+SkirU	2026-07-19 06:05:48.815349+00	d7927665-1624-474f-b836-fea304dc8105	t	2026-06-19 06:05:49.269439+00
04597ec9-c1d1-4685-8ec9-0f3612fb6e30	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$8QAvVzE1ObJw6fwnqwA3Ug$RYLLXlKFKXj0S1z8ZJfiYlVk1OjzSjtWq2WjsusXhaM	2026-07-19 07:22:27.747713+00	a51d4181-eadb-4d23-8285-84914d53de98	t	2026-06-19 07:22:27.840206+00
a2d03372-3882-458d-900a-474d508b9410	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$lzdQTk8ddZyr64Z67BHneg$0XGUEiv5XL4iaTJoFbqgAtg61WVnykwN0APx5x4tEkA	2026-07-19 07:22:32.509562+00	04597ec9-c1d1-4685-8ec9-0f3612fb6e30	t	2026-06-19 07:22:34.652936+00
a1f465e4-9f6c-4df6-b3f0-e10e87bb2643	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$Qb1aiSwb+iQkHgYoLd6hsw$UUP1u1hLjBxEgVVeZxRrRPktyOLrQfRt/Fr+ZxtNJ3Q	2026-07-19 07:22:57.068809+00	a2d03372-3882-458d-900a-474d508b9410	t	2026-06-19 07:22:57.208877+00
c449b20e-313e-4600-9190-9e897b332e45	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$w1U/Wfy1WVPzTzx9K6TjMg$0jAf74iOiJHoz6dpZIhVE+bthIgB8MaKcZc3w3Bnf2c	2026-07-19 07:20:04.467994+00	40ea9443-8bd1-4424-a864-9a5656c9b6d0	t	2026-06-19 07:20:04.741569+00
ecc54dd9-59ed-4f99-97d8-aec613a697de	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$9DJ7KZ2+EkDGQoK6AgCG3A$HpJHb1tdzMaWXw4NNx0tCcxntBnwRNuVekeMuplNAis	2026-07-19 07:25:28.584972+00	c449b20e-313e-4600-9190-9e897b332e45	t	2026-06-19 07:25:28.830254+00
e20d6863-971e-4253-9dfc-7a3b2276988e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$iP4mqan9wTf94YDjmbE+/g$388co9bmbLNU0xKFWBoim3WXVqDUYBEMxkP+VoVhbmk	2026-07-19 08:25:52.232146+00	ecc54dd9-59ed-4f99-97d8-aec613a697de	t	2026-06-19 08:25:52.447292+00
ca031cea-7387-4569-997e-ca2c3d69e2b1	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$WUHtRMN15BJEWHHM3W7CFw$C1awvrxhFnJxtKNNk/hKcYyvD/7MoI5HMtNXZOcJkzk	2026-07-19 08:48:49.420862+00	e20d6863-971e-4253-9dfc-7a3b2276988e	t	2026-06-19 08:48:49.816395+00
697a4575-9063-4d90-9c68-942269b5069c	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$P4oTvLSrcIko/BapmXPhpw$epMrhncqx7U75bjM6Hb/mC/M+4cKyTcdM7wAoPH5i6M	2026-07-19 09:16:22.755187+00	ca031cea-7387-4569-997e-ca2c3d69e2b1	t	2026-06-19 09:16:30.172912+00
58c8c131-4616-4f11-aab8-6117e21ae8bf	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$JPhC3RHyvelzlO5NrYPnPQ$fOIb3/fbaezdOB/wCk9G2kpAUfwxljrWBvQkjjNF8xQ	2026-07-19 09:38:34.865645+00	697a4575-9063-4d90-9c68-942269b5069c	t	2026-06-19 09:38:35.111354+00
1a84e6ed-2ce7-4584-a7b9-24bff90f619a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Ff8QZE6eD2TEFDlHr2spyQ$zuQOtyqeK4CDguM/eC+zQ9ZgJYPknHfPzZ7t6eASpB4	2026-07-19 09:39:19.423443+00	58c8c131-4616-4f11-aab8-6117e21ae8bf	t	2026-06-19 09:39:19.639494+00
1c8bcf13-bf1e-47a8-8106-9418c62d9bd5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$lIRrdtjMDN44o6NQWxRU2A$3c5iafr2jTtCLgnvckkrwLDrsG4uQEZ3IQFh6Q0WTco	2026-07-19 09:43:24.678226+00	1a84e6ed-2ce7-4584-a7b9-24bff90f619a	t	2026-06-19 09:43:24.906176+00
1ca1efa1-cd46-4d97-b554-13f1d5e6aa15	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$XjpIEyxgGF2o0/gxObJmKQ$fP6zlTLkzurLAdZo2it7fNX9sG2kP+X7M+SFyfYPPVE	2026-07-19 11:18:17.616227+00	\N	t	2026-06-19 11:18:17.620747+00
b41054f7-dcdd-4757-8d9e-4ef3cb11508f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$5p/wVE59NbVVUAFM4HLEAg$8aEVkO7oRR2ehzu9u+gZTCzoE2gqzMEN9R7PtrUbMu4	2026-07-19 11:18:19.384407+00	1ca1efa1-cd46-4d97-b554-13f1d5e6aa15	t	2026-06-19 11:18:20.014579+00
e1222bbd-66ef-4865-8290-ce256c5f6784	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$fbHOYR32/gN3y+2Frm912g$korJjAndKU+Bne5aIek1bOw+EyLsh1WExWzQmzXEWn0	2026-07-19 10:43:29.886164+00	1c8bcf13-bf1e-47a8-8106-9418c62d9bd5	t	2026-06-19 10:43:30.046447+00
7089f237-99c5-4383-99f4-441c8f6efa5f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$tRXTlu5YWP9JktnF25nT6Q$P+8Ju9YmnCr9577bPECrBnzkLW9rf7jt7UsdkqqCg5I	2026-07-19 11:24:45.54336+00	e1222bbd-66ef-4865-8290-ce256c5f6784	t	2026-06-19 11:24:45.858137+00
bb09c57b-8f84-430e-8eb6-1175a11d436b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ysY1n/0//JEm4NOwwV60Lw$ttIn8M3FSNbPd2eJQwnta7pQ+/gTVHNq96t2gu60yy8	2026-07-19 11:56:48.684564+00	7089f237-99c5-4383-99f4-441c8f6efa5f	t	2026-06-19 11:56:49.538895+00
8c172a1a-7883-42d3-b9b5-567816e5d198	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$SzCx9mYlD6HvUbtndljZlQ$oGLltcFL7EU4jbyMA2UIfoDUArdC3H6K8pzTSnxwkP0	2026-07-19 11:18:44.380956+00	b41054f7-dcdd-4757-8d9e-4ef3cb11508f	t	2026-06-19 11:18:44.503701+00
b7e9a6bc-41fb-4c5c-a18e-5643f2218d0e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$uH+TuMYU6MSRHNGG050kFA$ywJCKFrAHQHoVBJZl7x+N3zp4VaWzAHasSjxo63TlUs	2026-07-19 12:25:15.982408+00	8c172a1a-7883-42d3-b9b5-567816e5d198	t	2026-06-19 12:25:16.468717+00
4a72efdb-d2b2-4e6d-b2a4-392c92f1af94	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$whTyNIs16McmbEs5tecv+Q$r7TqiPQLfPbot2PInrtgSXnizPC1F1rniYBlHAscDbQ	2026-07-19 12:25:42.46649+00	b7e9a6bc-41fb-4c5c-a18e-5643f2218d0e	t	2026-06-19 12:25:42.641409+00
1b1c139d-e4be-4e19-a305-65f2d9f3e655	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$z2cZoy+9YF+Y1VBp05SOHA$CNEhwOO3xRFVdKgNR3CUhwQiIk5D/s0PikwWnTGWmvI	2026-07-19 11:56:57.604634+00	bb09c57b-8f84-430e-8eb6-1175a11d436b	t	2026-06-19 11:56:58.821329+00
a6e480e4-c832-4a3b-bfd8-449889ef48e4	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$zdsqYCpKF1ShI5lBIJnXcg$8PW06OMwce4+Sj1YteF+MXSoUD+606dCPQuFSkQoURw	2026-07-19 12:26:02.366666+00	4a72efdb-d2b2-4e6d-b2a4-392c92f1af94	t	2026-06-19 12:26:02.540906+00
fc52fa18-4ae6-4f89-b6c4-4f77e86207ef	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$FLh6MC075v+N+4N1F+BsgQ$DctfJSWsPWnKNqAtNeolhW70l6mofTzJOGnZZTCVpcI	2026-07-19 12:26:41.549955+00	a6e480e4-c832-4a3b-bfd8-449889ef48e4	t	2026-06-19 12:26:41.743924+00
f9eeb080-2f4c-449c-aaf6-bf73b99ac3b3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$gAckLN3jX7mEnJ15xUgReQ$CLpoiRUZUy/foKZ1OmauS20eMbO9lb9jUTW+QXKsHiE	2026-07-19 12:26:44.836542+00	fc52fa18-4ae6-4f89-b6c4-4f77e86207ef	t	2026-06-19 12:26:44.956365+00
61405fe4-4ae7-4866-905f-2535a3d391fb	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Na75sFv0rTNBisfDf6MFcw$0JqUSkAsn+4BABf2mH1Ea8FN97YCARz6ty+oy+wKPHQ	2026-07-19 12:26:47.546766+00	f9eeb080-2f4c-449c-aaf6-bf73b99ac3b3	t	2026-06-19 12:26:47.762412+00
50928cec-aa4e-4399-a4fe-0c7855a9c5bc	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$dOAWvL5Tj0qHOhUk8NVHhg$/GMpZuU5wDQVirOT8sL00lKVnvLhX33yyPwSf59RwI8	2026-07-19 13:54:29.153398+00	f5f120c3-c1ff-4284-86fb-66c330e44e72	t	2026-06-19 13:54:29.854914+00
f5f120c3-c1ff-4284-86fb-66c330e44e72	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$FPqGA7SjdaG54hcoXG7i4Q$sIEb0Vr1jhn5mC9x1NE+SaJ3BwP5hB0H0LG8JjIQc6s	2026-07-19 12:57:07.389022+00	1b1c139d-e4be-4e19-a305-65f2d9f3e655	t	2026-06-19 12:57:07.716163+00
75b9277c-5c4d-4249-bda5-00444901fcb3	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$lyaqJXt4AtrbdvZ98tNiXg$EOVLUnJKzQJuR8H5ZrnEac0zalhPgICQjFO4Oc0W12I	2026-07-19 13:54:42.545998+00	f5f120c3-c1ff-4284-86fb-66c330e44e72	f	2026-06-19 13:54:42.652099+00
1fddcc3c-9255-49fb-8e85-f7ef90d25002	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$mMaoJcrzZth3k7FRcjLgtg$TLS/371CSLNvEmB9u//xHQB2kQd9z+Lx61PhagmT3oQ	2026-07-19 12:26:55.973587+00	61405fe4-4ae7-4866-905f-2535a3d391fb	t	2026-06-19 12:26:56.145164+00
c4539a63-d7e6-4a13-87e3-dccace68908a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ivppswiwYohz+DhHIxyANw$Uc7TLBqZFYX14Dpr66LJjoH7+Ee/4kMXBfh2RYERx0Y	2026-07-19 14:02:00.399982+00	1fddcc3c-9255-49fb-8e85-f7ef90d25002	t	2026-06-19 14:02:00.520161+00
a5c1679c-4a5a-4be3-bb88-9b3443982d06	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$L01XNexpxs+vvj+mDyFvMg$X9iI9ZRNHow84m/xILEuY76veMJrzilHQM3+28t7WTs	2026-07-19 14:02:57.620396+00	6fb5637c-1463-4176-8863-da115f8439d7	t	2026-06-19 14:02:57.88905+00
10e44d8c-698a-4643-b312-114856d54055	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$IIHOg8l51awFu+v05po5/A$uAcSTsT3dPUhRzPhYYrT10LYvk1YyjDLnC69oQfUDr8	2026-07-20 05:38:55.630606+00	50928cec-aa4e-4399-a4fe-0c7855a9c5bc	f	2026-06-20 05:38:55.999064+00
f6e9e72e-7e6f-40f4-a910-de1977b2d15f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$2DKwI0S2AZvQBEjbjPhhKA$rz1ScEwGnMZNekePIWGfVyus2rgEVh7pew6tMTJjYCE	2026-07-19 14:03:40.965669+00	9e03b0fd-0194-4a59-8f20-9a5285539d6a	f	2026-06-19 14:03:47.360582+00
9e03b0fd-0194-4a59-8f20-9a5285539d6a	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$6LTu7kupk2XFkCbWrryOYw$Lo6Vca8LD1WX66L4Vmn+hYk+bc5YGk49ngOrf2CS14E	2026-07-19 14:03:24.097432+00	c4539a63-d7e6-4a13-87e3-dccace68908a	t	2026-06-19 14:03:24.551594+00
6ab10129-4b74-4a28-9979-5f7416706cfe	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$AUPl91ihiolV3HsoxyeSig$K7fN1gHKTfncj1nfZOkcigYRHohJPQTP6N+Gsa6VQIw	2026-07-19 14:03:47.905557+00	9e03b0fd-0194-4a59-8f20-9a5285539d6a	t	2026-06-19 14:03:49.197005+00
6fd462a6-60e8-4700-93a0-be2608eda6c9	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$XTjfoZULywTlsVeQ/IxgGA$cQk+sHWR67TdZi2i/z+ReL53uaHpJZ1y1lfraEfFxp0	2026-07-19 14:04:27.991075+00	\N	t	2026-06-19 14:04:27.992992+00
608f5e83-5eed-4c66-b23c-9d4de3c0fbb0	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$2N5hYyfF4dcVTd9Of4fSmw$9quxf3pbur+IMwUK0VSwgbl52LU//cD45K71P33H2CI	2026-07-19 14:04:33.264965+00	6fd462a6-60e8-4700-93a0-be2608eda6c9	t	2026-06-19 14:04:33.589614+00
047872b9-a029-42c8-b7b9-febcf9b63876	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$GtcdGTpwLj2e1BToULVUJQ$w8meJbBfqLf5bZAetY5FFwI+ssRdn9K8CIQNAIvtr+0	2026-07-19 14:03:34.790191+00	a5c1679c-4a5a-4be3-bb88-9b3443982d06	t	2026-06-19 14:03:35.194576+00
e152a3a7-0765-4851-b774-59ed7363704b	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	$argon2id$v=19$m=19456,t=2,p=1$AE5Qjy96YyiA6ed2l8BOlA$F+qc+i/ZCDq8Av+bJNwDnGZLC3akpyTuAqmBPSNei9c	2026-07-19 14:05:53.787699+00	047872b9-a029-42c8-b7b9-febcf9b63876	f	2026-06-19 14:05:54.048801+00
25f13989-a48a-408d-913a-80a98b48efc5	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$3+z1J0kdx7jP0ag1UPMIfw$EqYu0D7TEtThahM8wDBzN9xcCeQGk4TWtA0XIlPLaws	2026-07-19 14:05:11.944187+00	608f5e83-5eed-4c66-b23c-9d4de3c0fbb0	t	2026-06-19 14:05:12.490148+00
ab04ec31-6142-4ed2-8c45-8c47e7509551	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$rEU2pv5o3QCXQ0nzzbMSQg$q8XCrcB30G3gVJPyVR0QsTpj2+vaM17g8k/+EbWzt8k	2026-07-19 14:06:14.040632+00	25f13989-a48a-408d-913a-80a98b48efc5	t	2026-06-19 14:06:14.668115+00
eb80ea22-c179-460a-9da8-a171168d6e7d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$no3YaG53Uo0eMmBgvCfENw$iXdYc7S8HNyw3OMGkhvXgxF4OJkBdfPaokckh4HkYqs	2026-07-20 05:39:05.930581+00	\N	t	2026-06-20 05:39:05.93368+00
ad6dcfb7-7952-4313-9c6e-04f5f867ed6b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$TR/G28JRPXPvFH/k42LmPg$rfzUG8hXeNoHEeo4vKUSLIi1n63nWOyyNlvYkpN4TKg	2026-07-20 05:39:08.904682+00	eb80ea22-c179-460a-9da8-a171168d6e7d	t	2026-06-20 05:39:09.198293+00
eae5aa66-4fa1-4971-a76d-7094a6cfbee4	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$hlg8g50FXHWEOT5VsoNi4Q$c8ZZXS9/Pao2P7jKRNEAfIMtNpbEK+Mis5WpxIKHHMk	2026-07-20 05:39:16.220035+00	ad6dcfb7-7952-4313-9c6e-04f5f867ed6b	t	2026-06-20 05:39:16.599414+00
ee0e69dd-aba1-4ee5-b17e-1046b74b34d5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$lHc2+Oamnr0kwzxQe1pcfQ$HyynxrLmFgmYQNz2RZM5kIBVd4opaU0zih7bDMGs7qk	2026-07-20 05:40:22.699831+00	eae5aa66-4fa1-4971-a76d-7094a6cfbee4	t	2026-06-20 05:40:22.900294+00
1d17f370-f5e1-4a7f-b9cf-e314dec3a193	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$H3IRicwaVNehJaS/SqMqhA$kknTlif5fLIp3NaYnEMnD/Uyyd23IPjG/Tp7FRD7iEA	2026-07-20 21:03:37.412515+00	ee0e69dd-aba1-4ee5-b17e-1046b74b34d5	t	2026-06-20 21:03:37.602527+00
82bea9ce-1802-482f-ab9b-e4774757d749	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ky0nuDSht+4tfxATGMgVqA$V1aA+HlAT4dEGaDXEWX9dsKNQM15GuUYb5vLWwGT7q4	2026-07-21 18:09:20.510756+00	1d17f370-f5e1-4a7f-b9cf-e314dec3a193	f	2026-06-21 18:09:20.558809+00
2a0b8739-3fd6-4959-be47-b579f92c1e9c	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$XiS1LAUjKmpH82df3t7UKA$oaXfy9w+DNPYl968uLgGTJowORtT/Cwo6yKQvH8VU6Q	2026-07-21 22:29:37.527124+00	\N	t	2026-06-21 22:29:37.530209+00
4cab92d6-000b-46b1-8103-a4f2a54efa20	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$nqYQ92cB/h7hobzvEvcxtw$kTL/DBodhfo5mWzhCpqjzhY3xbIMfV0geK9rTaUlAJc	2026-07-21 22:29:39.643948+00	2a0b8739-3fd6-4959-be47-b579f92c1e9c	t	2026-06-21 22:29:39.765685+00
0f678230-fbd1-4e7d-bf20-2ee380681f60	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$OXz84nAZeWHV7hZIHkJYAw$oDVOgJobo8iCv8fAwctQ33a9fKFluhkCNGnY0h/O7kI	2026-07-21 22:29:45.454164+00	4cab92d6-000b-46b1-8103-a4f2a54efa20	t	2026-06-21 22:29:45.63214+00
11affdc0-f5b4-4ac5-a089-a00eeac78e6b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$K7blJSnfEAzuDoEqCRjh8A$YHA4Ng6wq2NrnYPdtBtaH5tYzry0jQ3+zoo07Rrdbzo	2026-07-21 22:37:08.408113+00	0f678230-fbd1-4e7d-bf20-2ee380681f60	t	2026-06-21 22:37:08.794839+00
cd19f4cc-81f5-433f-bafb-9da00582b161	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$/xV7FdoJNbqbvWJWr5oDrQ$R5cvV/YD9NrJOSNFjxGJ8U28RalIQq1BQk408pBkM3E	2026-07-21 22:38:13.664538+00	11affdc0-f5b4-4ac5-a089-a00eeac78e6b	t	2026-06-21 22:38:13.796132+00
cb8a3a3c-31e8-4015-9364-c5ac7bc7c775	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$ouoSjpqySu/UhEr9GQ1W7Q$MQcJgtQrsjVdMZgkaNycHDJR+9geVlLFuAEb7Fozv6E	2026-07-19 14:07:05.246876+00	ab04ec31-6142-4ed2-8c45-8c47e7509551	t	2026-06-19 14:07:05.558392+00
4ca1bd6d-e795-4dbe-aefa-5a8a8f633aa3	1747f31a-2972-4506-b997-1c03eb38aa6e	$argon2id$v=19$m=19456,t=2,p=1$i5tbeBtz+k9hoFjDaEZy0w$GIGPBMtaDk3qrhsNe8+OJ4n29Jk0t2R65G7J8AaSC/g	2026-07-21 22:42:40.055778+00	cb8a3a3c-31e8-4015-9364-c5ac7bc7c775	f	2026-06-21 22:42:40.145403+00
2723bbcd-a906-48bd-b932-27b847cb09e7	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$NmxtjbYw48anGXzzHNhE+g$dxhJrS58RIZPESl5FJoUeOwWdp/WBX0buHwTpqecm4s	2026-07-21 22:39:53.682679+00	cd19f4cc-81f5-433f-bafb-9da00582b161	t	2026-06-21 22:39:53.869746+00
8325f235-b3a4-491d-9055-43c83e11fbfe	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$dzs1+r55vUDQGky7x2SZgw$KeWFgFYcqgtia56tZ6qh58KiboJJvo2w3QsROhJwLGA	2026-07-21 22:43:16.619677+00	2723bbcd-a906-48bd-b932-27b847cb09e7	t	2026-06-21 22:43:16.747895+00
e82fd0d7-39d9-401b-b115-d7c93314b482	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$BS1s5EKjgf/g5lSPBhNJ+A$A87Oz5++rPW7EeK6uLA/OIr8NAnlPLys2QDlbOi8TKU	2026-07-21 22:43:18.443006+00	8325f235-b3a4-491d-9055-43c83e11fbfe	t	2026-06-21 22:43:18.631836+00
6e091ffc-dd1a-4e27-8aac-34a3b322cd2b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Wb61kduEi6GSb9EJYAkSRA$5Wly707IM9isqCWOzoO7pnJ/tNSppioTBWDSJOybUE0	2026-07-21 22:43:44.445565+00	e82fd0d7-39d9-401b-b115-d7c93314b482	t	2026-06-21 22:43:44.555442+00
0e2ea54a-4c30-466c-99a7-bfcbe29d794b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ALPNEZkEBZ0KdS5JY/Jg0Q$L5J72ZLg/RDMcbKqwKJcPphSpuBYvPk9zpfaGqyb9UQ	2026-07-21 22:43:55.257754+00	6e091ffc-dd1a-4e27-8aac-34a3b322cd2b	t	2026-06-21 22:43:55.411061+00
f460b29f-1580-4519-b7a9-3119c7725e1d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ARkKQwJGxlEFPomUNaCGfA$hBTJIMjzN/4d79PhPBvoLTH8VJogriMXx71ezvWaeBs	2026-07-21 22:45:13.122878+00	0e2ea54a-4c30-466c-99a7-bfcbe29d794b	t	2026-06-21 22:45:13.224196+00
edf05c40-d8e7-4719-956e-60ac3800b6f6	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Rr0Gxqz7RXnQ+ocXhLupJg$Oti6lFoW2qrGjxVVEqVMsoY807cGR6Zv1qcdguAeorw	2026-07-21 22:45:17.517214+00	f460b29f-1580-4519-b7a9-3119c7725e1d	t	2026-06-21 22:45:17.735251+00
f336e813-8e47-4ad8-a89f-6a10d6e4e954	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$ZcZxX6Kt7trD5tOfzXWZqQ$aATixUHDs02RvkVQdpAAR3kPjTcEl8AzraaT+WMAAx4	2026-07-21 22:46:03.11329+00	edf05c40-d8e7-4719-956e-60ac3800b6f6	t	2026-06-21 22:46:03.228366+00
60f90dd2-2d46-4874-a6a2-31f95a2b7325	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$tRRtdfyjKp2iGWdTiW2wNA$ovaV7sdAv/bKKlYqODQiFnxWMx0DaA5HbXt7NDHKwUs	2026-07-21 22:48:53.812883+00	f336e813-8e47-4ad8-a89f-6a10d6e4e954	t	2026-06-21 22:48:53.996577+00
83648a6b-11e1-40b2-8ca7-76b2f9de58b8	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$GUyBw7aBX48gIm8vOrSbbQ$5672aeCSlGxG5/jMyyJKAobqDfx4bKIvOUXiAhfD8c0	2026-07-21 22:52:48.244209+00	60f90dd2-2d46-4874-a6a2-31f95a2b7325	t	2026-06-21 22:52:48.359258+00
9649073d-f28d-40c6-9ec0-3ce07b09849b	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$YeqPuSdJWV/8r3XtmbWPEA$+naeSCyBXnhyAgG7kWKIFX/q69W+rHDiYxoQ0+ugEq8	2026-07-21 22:53:03.186626+00	83648a6b-11e1-40b2-8ca7-76b2f9de58b8	t	2026-06-21 22:53:03.290837+00
378f742d-1205-4285-b8d2-2d630ec1890e	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$x+w9mKDvAL5TjNyIjtEm2Q$jwlHdh3X7/q2BAjjqiLx2UyE1aDhFnj5zQoMrOELSo4	2026-07-21 22:53:19.474391+00	9649073d-f28d-40c6-9ec0-3ce07b09849b	t	2026-06-21 22:53:19.641094+00
de872611-fc35-4224-93f9-1e9fb1963b57	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$5cMEkdMdotGGVDyvdCqILw$L1MqcjK6lOz0rOVkslhN+r0jZz2tagiGn8HQUgkbp10	2026-07-21 23:06:39.175661+00	378f742d-1205-4285-b8d2-2d630ec1890e	t	2026-06-21 23:06:39.355697+00
8fde0673-1e9f-42f0-b6ef-8077d8c3707d	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$fBbk8v04SxoXavSPLOE70A$VVerseXGbX93R7Xm87q/yeWrwaxUe1Wm5SRIXeLJYoM	2026-07-21 23:07:13.788628+00	de872611-fc35-4224-93f9-1e9fb1963b57	t	2026-06-21 23:07:13.883688+00
4a5827a1-30b5-4baa-8541-223de8a3f8c8	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$y3KsIaouQJqGVAJvv3jp+A$lFcPOzA1d6f3uf9IJ9M0p4C1pPIALoGLZ8iuIIS1TQQ	2026-07-21 23:07:16.576202+00	8fde0673-1e9f-42f0-b6ef-8077d8c3707d	t	2026-06-21 23:07:16.766469+00
1f111609-4bc1-4c4b-9fcf-dd34aa538e59	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$LvnafDB7TBMY0QzP8KbC3A$MHMKewLCtdi7/Tirt5t835E7EQcVV3BSWl9F0/oQhJs	2026-07-21 23:07:31.564882+00	4a5827a1-30b5-4baa-8541-223de8a3f8c8	t	2026-06-21 23:07:31.669474+00
d5da9e64-d0c9-4084-bbb5-8f5da648b9ba	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$HcssuHmKTr5jsrNdN+M5MQ$mM3tFNoV8RMvOR6/8+ALwIp36UCmoH1REEENNEFfrGw	2026-07-21 23:48:36.379375+00	1f111609-4bc1-4c4b-9fcf-dd34aa538e59	t	2026-06-21 23:48:36.524702+00
6d56f61d-bb99-466e-855e-e86fc017fd6f	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	$argon2id$v=19$m=19456,t=2,p=1$Wk6U6yTlPVVHb/AaLwSp7A$rb6Qqp4wUb8Hl2HnB0MObpfO97jNQvC3sZrwbuELAqA	2026-07-22 00:17:35.259174+00	d5da9e64-d0c9-4084-bbb5-8f5da648b9ba	f	2026-06-22 00:17:35.426048+00
\.


--
-- Data for Name: user_identities; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.user_identities (id, user_id, provider, provider_user_id, email, email_verified, raw_profile, created_at, updated_at, last_login_at) FROM stdin;
34c98253-c871-4eb2-8671-4aa375918a2b	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	google	109193261788063740196	nuralysah90@gmail.com	t	{"aud": "289875119273-iafvd0iji2h15k4l0r4aojt64kc5up1g.apps.googleusercontent.com", "exp": "1781803286", "iss": "https://accounts.google.com", "sub": "109193261788063740196", "name": "Nur Alysah", "email": "nuralysah90@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "email_verified": "true"}	2026-06-18 16:21:28.459487+00	2026-06-18 16:21:28.459487+00	2026-06-18 16:21:28.459487+00
759a8e76-27d0-4a64-93e0-cc00371f4747	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	google	109091404271703494939	prestasiproperty7@gmail.com	t	{"aud": "289875119273-iafvd0iji2h15k4l0r4aojt64kc5up1g.apps.googleusercontent.com", "exp": "1781830917", "iss": "https://accounts.google.com", "sub": "109091404271703494939", "name": "PRESTASI PROPERTY", "email": "prestasiproperty7@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "email_verified": "true"}	2026-06-19 00:01:59.403581+00	2026-06-19 00:01:59.403581+00	2026-06-19 00:01:59.403581+00
1a765fe0-ac21-4196-b1ac-8214ffe96b3e	1747f31a-2972-4506-b997-1c03eb38aa6e	google	104705709147742782273	muhzannzs@gmail.com	t	{"aud": "289875119273-iafvd0iji2h15k4l0r4aojt64kc5up1g.apps.googleusercontent.com", "exp": "1781881457", "iss": "https://accounts.google.com", "sub": "104705709147742782273", "name": "Fauzan", "email": "muhzannzs@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "email_verified": "true"}	2026-06-18 12:44:15.617087+00	2026-06-19 14:04:27.46072+00	2026-06-19 14:04:27.46072+00
926148b4-0e41-46da-93a8-82c57e23f4f5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	google	105685214361219477879	fauzanyanuarp@gmail.com	t	{"aud": "289875119273-iafvd0iji2h15k4l0r4aojt64kc5up1g.apps.googleusercontent.com", "exp": "1782084576", "iss": "https://accounts.google.com", "sub": "105685214361219477879", "name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": "true"}	2026-06-18 12:37:40.164038+00	2026-06-21 22:29:36.164638+00	2026-06-21 22:29:36.164638+00
\.


--
-- Data for Name: user_profiles; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.user_profiles (user_id, full_name, bio, picture, username, birthdate, location, created_at, updated_at, metadata) FROM stdin;
c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	Nur Alysah	\N	https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c	nuralysah	\N	\N	2026-06-18 16:21:28.485988+00	2026-06-18 16:21:28.485988+00	{"google": {"name": "Nur Alysah", "email": "nuralysah90@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "email_verified": true, "provider_user_id": "109193261788063740196"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "auth_provider": "google"}
c8a11d02-d8bf-40b8-b54e-92909c3df8fd	PRESTASI PROPERTY	\N	https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c	prestasiproperty	\N	\N	2026-06-19 00:01:59.426932+00	2026-06-19 00:01:59.426932+00	{"google": {"name": "PRESTASI PROPERTY", "email": "prestasiproperty7@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "email_verified": true, "provider_user_id": "109091404271703494939"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "auth_provider": "google"}
1747f31a-2972-4506-b997-1c03eb38aa6e	Fauzan	\N	https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c	fauzan	\N	\N	2026-06-18 12:44:15.638151+00	2026-06-19 14:04:27.480035+00	{"google": {"name": "Fauzan", "email": "muhzannzs@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "email_verified": true, "provider_user_id": "104705709147742782273"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "auth_provider": "google"}
3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	Fauzan Yanuarp	\N	https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c	fauzanyanuarp	\N	\N	2026-06-18 12:37:40.280261+00	2026-06-21 22:29:36.17092+00	{"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.user_roles (user_id, role_id) FROM stdin;
3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	879dde1a-22d4-4843-b307-26a34e6ddb7d
1747f31a-2972-4506-b997-1c03eb38aa6e	879dde1a-22d4-4843-b307-26a34e6ddb7d
c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	879dde1a-22d4-4843-b307-26a34e6ddb7d
c8a11d02-d8bf-40b8-b54e-92909c3df8fd	879dde1a-22d4-4843-b307-26a34e6ddb7d
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: core; Owner: app
--

COPY core.users (id, email, email_verified, password_hash, password_changed_at, phone, phone_verified, status, is_active, failed_login_attempts, lockout_expires_at, last_login_at, deleted_at, public_key_jwks, actor_id, updated_by, created_at, updated_at) FROM stdin;
c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	nuralysah90@gmail.com	t	\N	2026-06-18 16:21:28.37931+00	\N	f	active	t	0	\N	2026-06-18 16:21:28.37931+00	\N	\N	\N	\N	2026-06-18 16:21:28.37931+00	2026-06-18 16:21:28.37931+00
c8a11d02-d8bf-40b8-b54e-92909c3df8fd	prestasiproperty7@gmail.com	t	\N	2026-06-19 00:01:59.244521+00	\N	f	active	t	0	\N	2026-06-19 00:01:59.244521+00	\N	\N	\N	\N	2026-06-19 00:01:59.244521+00	2026-06-19 00:01:59.244521+00
1747f31a-2972-4506-b997-1c03eb38aa6e	muhzannzs@gmail.com	t	\N	2026-06-18 12:44:15.592824+00	\N	f	active	t	0	\N	2026-06-19 14:04:27.174923+00	\N	\N	\N	\N	2026-06-18 12:44:15.592824+00	2026-06-19 14:04:27.174923+00
3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	fauzanyanuarp@gmail.com	t	\N	2026-06-18 12:37:40.064727+00	\N	f	active	t	0	\N	2026-06-21 22:29:36.090017+00	\N	\N	\N	\N	2026-06-18 12:37:40.064727+00	2026-06-21 22:29:36.090017+00
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: events; Owner: app
--

COPY events.audit_logs (id, actor_id, user_id, entity, action, metadata, ip_address, user_agent, created_at) FROM stdin;
1	\N	652fdc71-733f-4ee5-92b4-b9e48ad8fca7	permissions	INSERT	{"new": {"id": "652fdc71-733f-4ee5-92b4-b9e48ad8fca7", "name": "system:manage", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Full system control"}}	\N	\N	2026-06-18 12:31:38.580339+00
2	\N	7fd70902-0006-4bc5-9e51-a020ed9082e8	permissions	INSERT	{"new": {"id": "7fd70902-0006-4bc5-9e51-a020ed9082e8", "name": "system:view_logs", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Read audit logs"}}	\N	\N	2026-06-18 12:31:38.580339+00
3	\N	8c146564-b7ce-424a-b40a-567beef1857e	permissions	INSERT	{"new": {"id": "8c146564-b7ce-424a-b40a-567beef1857e", "name": "system:update_roles", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Manage global roles & permissions"}}	\N	\N	2026-06-18 12:31:38.580339+00
4	\N	17c65554-5677-465f-8a22-3f2a78bbde6c	permissions	INSERT	{"new": {"id": "17c65554-5677-465f-8a22-3f2a78bbde6c", "name": "org:create", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Create organization"}}	\N	\N	2026-06-18 12:31:38.580339+00
5	\N	4eeb91ae-393d-4abc-81a7-2544beb2164e	permissions	INSERT	{"new": {"id": "4eeb91ae-393d-4abc-81a7-2544beb2164e", "name": "org:read", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Read organization"}}	\N	\N	2026-06-18 12:31:38.580339+00
6	\N	35e9947f-18d0-4cd8-9112-b548bfdffbb0	permissions	INSERT	{"new": {"id": "35e9947f-18d0-4cd8-9112-b548bfdffbb0", "name": "org:update", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Update organization"}}	\N	\N	2026-06-18 12:31:38.580339+00
7	\N	ca52ad81-38ad-4780-b3a1-e16c09268754	permissions	INSERT	{"new": {"id": "ca52ad81-38ad-4780-b3a1-e16c09268754", "name": "org:delete", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Delete organization"}}	\N	\N	2026-06-18 12:31:38.580339+00
8	\N	7c305a3a-4379-4ea1-a2de-b294bc34a34e	permissions	INSERT	{"new": {"id": "7c305a3a-4379-4ea1-a2de-b294bc34a34e", "name": "org:invite_member", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Invite organization member"}}	\N	\N	2026-06-18 12:31:38.580339+00
9	\N	0669150b-c50c-4475-aa31-3afb4e20090e	permissions	INSERT	{"new": {"id": "0669150b-c50c-4475-aa31-3afb4e20090e", "name": "org:remove_member", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Remove organization member"}}	\N	\N	2026-06-18 12:31:38.580339+00
10	\N	6c992007-d1ad-46f9-8c51-8f21e48936a0	permissions	INSERT	{"new": {"id": "6c992007-d1ad-46f9-8c51-8f21e48936a0", "name": "org:update_member_role", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Change organization member role"}}	\N	\N	2026-06-18 12:31:38.580339+00
11	\N	717a1a13-310a-4b44-bc56-d9c3288b0026	permissions	INSERT	{"new": {"id": "717a1a13-310a-4b44-bc56-d9c3288b0026", "name": "buyer:read_own", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Read own buyer data"}}	\N	\N	2026-06-18 12:31:38.580339+00
12	\N	0e01da00-6dfb-48a6-b6c5-4a39e900fbb4	permissions	INSERT	{"new": {"id": "0e01da00-6dfb-48a6-b6c5-4a39e900fbb4", "name": "buyer:update_own", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Update own buyer data"}}	\N	\N	2026-06-18 12:31:38.580339+00
13	\N	34547258-b2ab-49f4-aa33-1c40ecd2e518	roles	INSERT	{"new": {"id": "34547258-b2ab-49f4-aa33-1c40ecd2e518", "name": "super_admin", "system": true, "role_type": "global", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Platform Super Administrator with full access"}}	\N	\N	2026-06-18 12:31:38.580339+00
14	\N	d5f32dd8-7621-4fb5-89e5-4a46f5c1c6ec	roles	INSERT	{"new": {"id": "d5f32dd8-7621-4fb5-89e5-4a46f5c1c6ec", "name": "read_only", "system": true, "role_type": "global", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Read-only user"}}	\N	\N	2026-06-18 12:31:38.580339+00
15	\N	879dde1a-22d4-4843-b307-26a34e6ddb7d	roles	INSERT	{"new": {"id": "879dde1a-22d4-4843-b307-26a34e6ddb7d", "name": "buyer", "system": true, "role_type": "global", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Default buyer role"}}	\N	\N	2026-06-18 12:31:38.580339+00
16	\N	d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b	roles	INSERT	{"new": {"id": "d4b1353f-c3c0-4d71-9dbe-28abe1d4bb5b", "name": "org_admin", "system": true, "role_type": "org", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Organization administrator"}}	\N	\N	2026-06-18 12:31:38.580339+00
17	\N	d1eb4059-040f-44a6-9af7-93be55fabaf5	roles	INSERT	{"new": {"id": "d1eb4059-040f-44a6-9af7-93be55fabaf5", "name": "org_member", "system": true, "role_type": "org", "created_at": "2026-06-18T12:31:38.580339+00:00", "updated_at": "2026-06-18T12:31:38.580339+00:00", "description": "Organization member"}}	\N	\N	2026-06-18 12:31:38.580339+00
18	\N	33768fb2-defc-4a66-a295-90ff2a2d78fc	roles	INSERT	{"new": {"id": "33768fb2-defc-4a66-a295-90ff2a2d78fc", "name": "admin", "system": true, "role_type": "global", "created_at": "2026-06-18T12:31:40.372637+00:00", "updated_at": "2026-06-18T12:31:40.372637+00:00", "description": "Platform admin role alias"}}	\N	\N	2026-06-18 12:31:40.372637+00
19	\N	b03b0581-04a6-48a4-990d-9f73ae987dfc	roles	INSERT	{"new": {"id": "b03b0581-04a6-48a4-990d-9f73ae987dfc", "name": "content_admin", "system": true, "role_type": "global", "created_at": "2026-06-18T12:31:40.372637+00:00", "updated_at": "2026-06-18T12:31:40.372637+00:00", "description": "CMS content administrator"}}	\N	\N	2026-06-18 12:31:40.372637+00
20	\N	d36290b9-cc1c-4d0c-a698-335e6801126a	roles	INSERT	{"new": {"id": "d36290b9-cc1c-4d0c-a698-335e6801126a", "name": "sales", "system": true, "role_type": "global", "created_at": "2026-06-18T12:31:40.372637+00:00", "updated_at": "2026-06-18T12:31:40.372637+00:00", "description": "CRM sales operator"}}	\N	\N	2026-06-18 12:31:40.372637+00
21	\N	d95fbd7e-7d38-4dfa-a231-e9e2f2090a66	roles	INSERT	{"new": {"id": "d95fbd7e-7d38-4dfa-a231-e9e2f2090a66", "name": "support", "system": true, "role_type": "global", "created_at": "2026-06-18T12:31:40.372637+00:00", "updated_at": "2026-06-18T12:31:40.372637+00:00", "description": "CRM support agent"}}	\N	\N	2026-06-18 12:31:40.372637+00
22	\N	\N	user	token.refresh_failed	{"session": "a37f5741-bc93-4c7e-8024-ca302ad9f305"}	\N	node	2026-06-18 12:37:08.353473+00
23	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	users	INSERT	{"new": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-18T12:37:40.064727+00:00", "updated_by": null, "last_login_at": "2026-06-18T12:37:40.064727+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-18 12:37:40.064727+00
24	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user_profiles	INSERT	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-18T12:37:40.280261+00:00"}}	\N	\N	2026-06-18 12:37:40.280261+00
25	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	oauth.google.login.success	{"email": "fauzanyanuarp@gmail.com", "provider": "google", "provider_user_id": "105685214361219477879"}	\N	node	2026-06-18 12:37:41.68128+00
26	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c7595e21-d569-4ffe-9b52-d1de36b5400c", "old_session": "2bda9fa0-59b7-42ed-b1fc-b30a9617039d"}	\N	node	2026-06-18 12:37:54.44439+00
27	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "85fb1be8-b944-41b8-965b-8144715ad2fb", "old_session": "c7595e21-d569-4ffe-9b52-d1de36b5400c"}	\N	node	2026-06-18 12:37:56.71562+00
28	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "706e2190-0cdb-49f5-9d1f-0f7fc1715d02", "old_session": "85fb1be8-b944-41b8-965b-8144715ad2fb"}	\N	node	2026-06-18 12:38:03.619992+00
29	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f05834d4-a5ec-4e36-842f-90fb8a66235b", "old_session": "706e2190-0cdb-49f5-9d1f-0f7fc1715d02"}	\N	node	2026-06-18 12:39:08.837303+00
30	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "84141df0-6cc9-4cf3-b1f4-a09e571fda6f", "old_session": "f05834d4-a5ec-4e36-842f-90fb8a66235b"}	\N	node	2026-06-18 12:41:06.172838+00
31	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "510e3397-1f56-437e-a593-a6bab52d50a2", "old_session": "84141df0-6cc9-4cf3-b1f4-a09e571fda6f"}	\N	node	2026-06-18 12:41:15.198882+00
32	\N	\N	user	token.refresh_failed	{"session": "d3a3159c-0c40-4eca-8223-24ca386f7433"}	\N	node	2026-06-18 12:42:27.79772+00
33	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "d25625d1-c56e-47ff-bd5d-7b2cd54a28a5", "old_session": "510e3397-1f56-437e-a593-a6bab52d50a2"}	\N	node	2026-06-18 12:44:07.64929+00
34	\N	1747f31a-2972-4506-b997-1c03eb38aa6e	users	INSERT	{"new": {"id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "email": "muhzannzs@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:44:15.592824+00:00", "deleted_at": null, "updated_at": "2026-06-18T12:44:15.592824+00:00", "updated_by": null, "last_login_at": "2026-06-18T12:44:15.592824+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:44:15.592824+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-18 12:44:15.592824+00
35	\N	1747f31a-2972-4506-b997-1c03eb38aa6e	user_profiles	INSERT	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "location": null, "metadata": {"google": {"name": "Fauzan", "email": "muhzannzs@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "email_verified": true, "provider_user_id": "104705709147742782273"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "auth_provider": "google"}, "username": "fauzan", "birthdate": null, "full_name": "Fauzan", "created_at": "2026-06-18T12:44:15.638151+00:00", "search_tsv": "'fauzan':1", "updated_at": "2026-06-18T12:44:15.638151+00:00"}}	\N	\N	2026-06-18 12:44:15.638151+00
36	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	oauth.google.login.success	{"email": "muhzannzs@gmail.com", "provider": "google", "provider_user_id": "104705709147742782273"}	\N	node	2026-06-18 12:44:16.150472+00
37	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "9aafa152-84ab-404b-a5cb-724b4cb23cec", "old_session": "1737e606-a3a2-43af-9c4d-6ff94ce30f70"}	\N	node	2026-06-18 12:44:20.35256+00
38	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "6e5edb08-db9c-4144-baf0-2250a8d17a0f", "old_session": "9aafa152-84ab-404b-a5cb-724b4cb23cec"}	\N	node	2026-06-18 12:45:24.984513+00
39	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "633b9223-26ec-4509-b31e-199b82adec33", "old_session": "d25625d1-c56e-47ff-bd5d-7b2cd54a28a5"}	\N	node	2026-06-18 12:46:34.865047+00
40	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "2b76fdfd-6db5-401f-9ba8-a5cc32d16066", "old_session": "633b9223-26ec-4509-b31e-199b82adec33"}	\N	node	2026-06-18 13:09:55.110078+00
41	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "bab5cb6e-200c-4954-906d-a9fc53d7c2d5", "old_session": "2b76fdfd-6db5-401f-9ba8-a5cc32d16066"}	\N	node	2026-06-18 13:13:54.209451+00
42	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "89140b0b-125b-4e50-8f10-6c6b28f35a3e", "old_session": "bab5cb6e-200c-4954-906d-a9fc53d7c2d5"}	\N	node	2026-06-18 13:13:56.210275+00
43	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "77da99b4-65aa-466b-92e2-53f6b94643b9", "old_session": "89140b0b-125b-4e50-8f10-6c6b28f35a3e"}	\N	node	2026-06-18 13:14:02.484929+00
44	\N	\N	user	token.refresh_failed	{"session": "9df8e9a8-79cf-4fc0-a1ec-7e124cb799df"}	\N	node	2026-06-18 13:31:21.072911+00
45	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "cb6294d5-67ec-4bba-bb1b-a77460f9dfd4", "old_session": "6e5edb08-db9c-4144-baf0-2250a8d17a0f"}	\N	node	2026-06-18 14:46:04.681171+00
46	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "334a2779-d61c-45d0-95f6-05d4528d56cb", "old_session": "cb6294d5-67ec-4bba-bb1b-a77460f9dfd4"}	\N	node	2026-06-18 14:46:09.532807+00
47	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "ad160584-9afa-4ff5-868f-61922bfc622b", "old_session": "334a2779-d61c-45d0-95f6-05d4528d56cb"}	\N	node	2026-06-18 14:46:16.179191+00
48	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "22c796f8-1cab-4e23-be44-6401184c16d6", "old_session": "ad160584-9afa-4ff5-868f-61922bfc622b"}	\N	node	2026-06-18 14:46:29.273683+00
68	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	oauth.google.login.success	{"email": "nuralysah90@gmail.com", "provider": "google", "provider_user_id": "109193261788063740196"}	\N	node	2026-06-18 16:21:28.633886+00
69	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "98195865-22dc-495f-8e14-0294dc0d3d36", "old_session": "6cd3425f-bab7-46af-a558-b156f0682462"}	\N	node	2026-06-18 16:21:29.414602+00
70	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "a25a812d-a6b2-4d15-a941-0ba22c0ea29f", "old_session": "e349576e-fe88-4f5a-9f88-c270987e98c2"}	\N	node	2026-06-18 16:21:41.939732+00
49	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	users	UPDATE	{"new": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-18T15:24:37.237155+00:00", "updated_by": null, "last_login_at": "2026-06-18T15:24:37.237155+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "old": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-18T12:37:40.064727+00:00", "updated_by": null, "last_login_at": "2026-06-18T12:37:40.064727+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-18 15:24:37.237155+00
50	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user_profiles	UPDATE	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-18T15:24:37.304093+00:00"}, "old": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-18T12:37:40.280261+00:00"}}	\N	\N	2026-06-18 15:24:37.304093+00
51	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	oauth.google.login.success	{"email": "fauzanyanuarp@gmail.com", "provider": "google", "provider_user_id": "105685214361219477879"}	\N	node	2026-06-18 15:24:38.028881+00
52	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "27ed5235-1228-4a9a-949d-dd4158350226", "old_session": "88becb6a-b74c-467a-a326-ccde198c6b0d"}	\N	node	2026-06-18 15:24:45.027171+00
53	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "b01f6147-270b-466f-b9f1-990c68bd9127", "old_session": "88becb6a-b74c-467a-a326-ccde198c6b0d"}	\N	node	2026-06-18 15:24:45.225425+00
54	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c0d00fa2-c329-48c1-a203-f47e30e55b82", "old_session": "b01f6147-270b-466f-b9f1-990c68bd9127"}	\N	node	2026-06-18 15:26:15.019914+00
55	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "2be0d6d2-c4bf-4b25-9a5d-4709cc86c596", "old_session": "22c796f8-1cab-4e23-be44-6401184c16d6"}	\N	node	2026-06-18 15:26:46.080256+00
56	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "b931b21a-3848-4a26-b9cd-780f24c72a89", "old_session": "2be0d6d2-c4bf-4b25-9a5d-4709cc86c596"}	\N	node	2026-06-18 15:27:19.003256+00
57	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "2811c081-5354-499d-ad32-e73be7fc920e", "old_session": "c0d00fa2-c329-48c1-a203-f47e30e55b82"}	\N	node	2026-06-18 15:31:40.425828+00
58	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "60cbf538-cb39-47ff-a9db-9dd72a72c52a", "old_session": "2811c081-5354-499d-ad32-e73be7fc920e"}	\N	node	2026-06-18 15:32:27.594002+00
59	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "5b1dfa7d-adcf-46bb-a580-1176045c2967", "old_session": "60cbf538-cb39-47ff-a9db-9dd72a72c52a"}	\N	node	2026-06-18 15:32:29.5012+00
60	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "43c09710-6715-4851-8961-fa67cbf7cd08", "old_session": "5b1dfa7d-adcf-46bb-a580-1176045c2967"}	\N	node	2026-06-18 16:05:43.29135+00
61	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "fd87f58e-85d4-451a-8e69-6f09a976bba6", "old_session": "b931b21a-3848-4a26-b9cd-780f24c72a89"}	\N	node	2026-06-18 16:17:43.880197+00
62	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "fc6896ce-b105-44d3-a658-79fe7e8b3a5a", "old_session": "fd87f58e-85d4-451a-8e69-6f09a976bba6"}	\N	node	2026-06-18 16:17:58.982734+00
63	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "046eeca3-4168-429c-913a-680ef1223595", "old_session": "fc6896ce-b105-44d3-a658-79fe7e8b3a5a"}	\N	node	2026-06-18 16:20:38.761108+00
64	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "a4649a70-b414-4d8a-9b31-a1eeb0c0ea41", "old_session": "046eeca3-4168-429c-913a-680ef1223595"}	\N	node	2026-06-18 16:21:16.031112+00
65	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "e349576e-fe88-4f5a-9f88-c270987e98c2", "old_session": "a4649a70-b414-4d8a-9b31-a1eeb0c0ea41"}	\N	node	2026-06-18 16:21:24.032005+00
66	\N	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	users	INSERT	{"new": {"id": "c3620d3b-4fc3-4eb7-babd-ecfdafb212c9", "email": "nuralysah90@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T16:21:28.37931+00:00", "deleted_at": null, "updated_at": "2026-06-18T16:21:28.37931+00:00", "updated_by": null, "last_login_at": "2026-06-18T16:21:28.37931+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T16:21:28.37931+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-18 16:21:28.37931+00
67	\N	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user_profiles	INSERT	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "user_id": "c3620d3b-4fc3-4eb7-babd-ecfdafb212c9", "location": null, "metadata": {"google": {"name": "Nur Alysah", "email": "nuralysah90@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "email_verified": true, "provider_user_id": "109193261788063740196"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "auth_provider": "google"}, "username": "nuralysah", "birthdate": null, "full_name": "Nur Alysah", "created_at": "2026-06-18T16:21:28.485988+00:00", "search_tsv": "'alysah':2 'nur':1", "updated_at": "2026-06-18T16:21:28.485988+00:00"}}	\N	\N	2026-06-18 16:21:28.485988+00
71	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "b3621653-9b08-4308-88f6-81415e00b53b", "old_session": "a25a812d-a6b2-4d15-a941-0ba22c0ea29f"}	\N	node	2026-06-18 16:22:11.127787+00
73	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "282fb927-ceec-404d-a688-3e504b6df06b", "old_session": "94a1c8f6-f4c4-42c6-9513-da4b3325c8af"}	\N	node	2026-06-18 16:22:30.530632+00
75	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "08db7f2d-bbfe-44d3-b18b-f8232a2db705", "old_session": "98195865-22dc-495f-8e14-0294dc0d3d36"}	\N	node	2026-06-18 16:23:08.746073+00
76	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "0fc0a300-4245-4f12-a277-b2378489b71e", "old_session": "3b72c2f9-11f3-4c00-b6b2-fd960ab76a68"}	\N	node	2026-06-18 16:24:28.243561+00
77	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "8283659b-3ac4-448f-a23f-b2f5193b6d1f", "old_session": "0fc0a300-4245-4f12-a277-b2378489b71e"}	\N	node	2026-06-18 16:25:46.51855+00
78	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "8883824f-bd25-4ea7-9e3d-4938b02c5cd6", "old_session": "8283659b-3ac4-448f-a23f-b2f5193b6d1f"}	\N	node	2026-06-18 16:26:16.900694+00
80	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "bc5e55ad-c959-4b88-9f42-536ce394c857", "old_session": "8883824f-bd25-4ea7-9e3d-4938b02c5cd6"}	\N	node	2026-06-18 16:26:37.941204+00
72	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "94a1c8f6-f4c4-42c6-9513-da4b3325c8af", "old_session": "b3621653-9b08-4308-88f6-81415e00b53b"}	\N	node	2026-06-18 16:22:19.758295+00
74	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "3b72c2f9-11f3-4c00-b6b2-fd960ab76a68", "old_session": "282fb927-ceec-404d-a688-3e504b6df06b"}	\N	node	2026-06-18 16:22:35.535253+00
79	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "3ef9c0e1-c885-4c7e-a170-97f53976b89d", "old_session": "08db7f2d-bbfe-44d3-b18b-f8232a2db705"}	\N	node	2026-06-18 16:26:20.015935+00
81	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "ec32b8d5-e433-43ce-b6ea-441ba0123df0", "old_session": "3ef9c0e1-c885-4c7e-a170-97f53976b89d"}	\N	node	2026-06-18 16:26:48.822125+00
82	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "64471e94-4a9a-4d94-b332-6a82f4181343", "old_session": "bc5e55ad-c959-4b88-9f42-536ce394c857"}	\N	node	2026-06-18 16:26:55.00525+00
83	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "7de05b87-92bb-42fe-96c5-d0c9b7aeadf5", "old_session": "64471e94-4a9a-4d94-b332-6a82f4181343"}	\N	node	2026-06-18 16:27:04.014654+00
84	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "c3c7129b-194b-44d9-9a41-f0e838488a81", "old_session": "ec32b8d5-e433-43ce-b6ea-441ba0123df0"}	\N	node	2026-06-18 16:27:20.298335+00
85	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "6fb5637c-1463-4176-8863-da115f8439d7", "old_session": "c3c7129b-194b-44d9-9a41-f0e838488a81"}	\N	node	2026-06-18 16:27:24.103389+00
86	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "65a2b7d9-e990-47ba-84e7-db4815c0b72f", "old_session": "7de05b87-92bb-42fe-96c5-d0c9b7aeadf5"}	\N	node	2026-06-18 16:28:53.902255+00
87	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "c0202064-54f3-458e-b280-37dffaa9e6b8", "old_session": "65a2b7d9-e990-47ba-84e7-db4815c0b72f"}	\N	node	2026-06-18 16:57:43.422881+00
88	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "953cfda1-1664-4009-b9fe-5e3fd39e4a37", "old_session": "c0202064-54f3-458e-b280-37dffaa9e6b8"}	\N	node	2026-06-18 16:57:45.271488+00
89	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "373f163a-0b06-4709-9ee6-ef12d3e2d745", "old_session": "953cfda1-1664-4009-b9fe-5e3fd39e4a37"}	\N	node	2026-06-18 16:57:52.262891+00
90	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "645c8084-a362-4458-b43d-4ea9b85090df", "old_session": "373f163a-0b06-4709-9ee6-ef12d3e2d745"}	\N	node	2026-06-18 17:02:37.262116+00
91	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "b9e2cb78-0195-45f6-867d-c1eb98656260", "old_session": "645c8084-a362-4458-b43d-4ea9b85090df"}	\N	node	2026-06-18 17:02:59.523455+00
92	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "9383627e-9a05-4e2f-bffc-43a4366fb31b", "old_session": "43c09710-6715-4851-8961-fa67cbf7cd08"}	\N	node	2026-06-18 17:05:51.611733+00
93	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6be9f67b-61c3-494c-b9e8-3810a4c35c18", "old_session": "9383627e-9a05-4e2f-bffc-43a4366fb31b"}	\N	node	2026-06-18 17:08:08.996049+00
94	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "07159f46-f35e-4bad-ab3a-b6780be6c53a", "old_session": "6be9f67b-61c3-494c-b9e8-3810a4c35c18"}	\N	node	2026-06-18 17:08:57.710291+00
95	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "00b456da-452f-477b-9bb3-3f017775c023", "old_session": "07159f46-f35e-4bad-ab3a-b6780be6c53a"}	\N	node	2026-06-18 17:12:28.413609+00
96	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f1f7bf67-3a51-4f09-bb77-11a92bd55da3", "old_session": "00b456da-452f-477b-9bb3-3f017775c023"}	\N	node	2026-06-18 17:13:13.35413+00
97	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "e1d4f13f-2541-425b-a14f-ba66680f985d", "old_session": "f1f7bf67-3a51-4f09-bb77-11a92bd55da3"}	\N	node	2026-06-18 17:13:29.976119+00
98	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "83e387ad-c31e-4e27-8ade-cd77dd656905", "old_session": "e1d4f13f-2541-425b-a14f-ba66680f985d"}	\N	node	2026-06-18 17:21:54.700302+00
99	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "2ff196b7-fe71-4831-9a62-cbb6cf644ce8", "old_session": "83e387ad-c31e-4e27-8ade-cd77dd656905"}	\N	node	2026-06-18 17:30:36.053045+00
100	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "2e4f4f79-278c-48d0-b789-a5345b0b1df7", "old_session": "b9e2cb78-0195-45f6-867d-c1eb98656260"}	\N	node	2026-06-18 17:30:58.186856+00
101	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "e2c09594-2484-4d2e-9a48-7aa402994885", "old_session": "2e4f4f79-278c-48d0-b789-a5345b0b1df7"}	\N	node	2026-06-18 17:31:02.498168+00
102	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "bf7155ba-861c-4881-8e43-b07a25fd0892", "old_session": "2ff196b7-fe71-4831-9a62-cbb6cf644ce8"}	\N	node	2026-06-18 17:31:53.79357+00
103	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "d5b3116e-d224-4a18-a074-66713b17cb50", "old_session": "bf7155ba-861c-4881-8e43-b07a25fd0892"}	\N	node	2026-06-18 17:32:32.292855+00
104	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6462663a-03e2-4fda-88d5-2663bec5b148", "old_session": "d5b3116e-d224-4a18-a074-66713b17cb50"}	\N	node	2026-06-18 17:33:51.033634+00
105	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c1335f16-7f87-4e09-81b3-cd72b9958a71", "old_session": "6462663a-03e2-4fda-88d5-2663bec5b148"}	\N	node	2026-06-18 18:06:40.606052+00
106	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8ea1aee0-5d55-40cb-983a-87e117520b37", "old_session": "c1335f16-7f87-4e09-81b3-cd72b9958a71"}	\N	node	2026-06-18 18:12:51.247357+00
107	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "5517b30e-1d27-446f-90c4-f6409ef2ba9f", "old_session": "8ea1aee0-5d55-40cb-983a-87e117520b37"}	\N	node	2026-06-18 18:36:52.574164+00
108	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "9582f2bb-4640-4100-85c5-6f44609c88c2", "old_session": "5517b30e-1d27-446f-90c4-f6409ef2ba9f"}	\N	node	2026-06-18 18:47:50.884634+00
109	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "4c0c5997-65d7-45a9-9948-b686ac4ea9ac", "old_session": "9582f2bb-4640-4100-85c5-6f44609c88c2"}	\N	node	2026-06-18 18:50:23.82771+00
110	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "0429fd68-b094-4352-8628-21f54fdb38a2", "old_session": "e2c09594-2484-4d2e-9a48-7aa402994885"}	\N	node	2026-06-18 18:59:42.273682+00
111	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "cc2f317b-24e5-45fa-93cf-a77a4a1e1c50", "old_session": "4c0c5997-65d7-45a9-9948-b686ac4ea9ac"}	\N	node	2026-06-18 19:06:50.847108+00
112	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8373dd64-b2b0-4791-8b93-3767f78c07cc", "old_session": "cc2f317b-24e5-45fa-93cf-a77a4a1e1c50"}	\N	node	2026-06-18 19:37:51.637164+00
113	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "5fb164e0-52a2-48ef-a278-bfedfe2101c5", "old_session": "8373dd64-b2b0-4791-8b93-3767f78c07cc"}	\N	node	2026-06-18 19:42:09.180228+00
114	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "a84d8c96-9bcb-4790-86f0-5ae215fbbde4", "old_session": "5fb164e0-52a2-48ef-a278-bfedfe2101c5"}	\N	node	2026-06-18 19:42:16.744669+00
115	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "95bbd50c-aaa3-4004-bc27-10cbbf882f87", "old_session": "a84d8c96-9bcb-4790-86f0-5ae215fbbde4"}	\N	node	2026-06-18 19:42:53.277239+00
116	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "7cedf950-05f2-4417-95e2-51ee04c9b15e", "old_session": "95bbd50c-aaa3-4004-bc27-10cbbf882f87"}	\N	node	2026-06-18 19:42:58.173224+00
117	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "16222542-de96-44bd-94df-1dc7111d6127", "old_session": "7cedf950-05f2-4417-95e2-51ee04c9b15e"}	\N	node	2026-06-18 19:43:18.667427+00
118	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "3f896a53-332e-48cc-8b19-c75cdd92526d", "old_session": "16222542-de96-44bd-94df-1dc7111d6127"}	\N	node	2026-06-18 19:44:06.453691+00
119	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ebe219c0-bd7a-4e88-b60c-9c42f18c95ff", "old_session": "3f896a53-332e-48cc-8b19-c75cdd92526d"}	\N	node	2026-06-18 19:45:58.562199+00
120	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "3c69cbd6-9b99-4aae-a3c7-9447af1cf5f7", "old_session": "ebe219c0-bd7a-4e88-b60c-9c42f18c95ff"}	\N	node	2026-06-18 19:58:12.268828+00
121	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "39860f0d-ca07-4ddd-be28-a446536096a6", "old_session": "3c69cbd6-9b99-4aae-a3c7-9447af1cf5f7"}	\N	node	2026-06-18 20:05:48.688468+00
122	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "79da3692-bb43-4a6e-97ab-f870e968c8a7", "old_session": "39860f0d-ca07-4ddd-be28-a446536096a6"}	\N	node	2026-06-18 20:08:47.267997+00
123	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "0ab38c89-32d8-4237-a699-d007a9df4e5d", "old_session": "79da3692-bb43-4a6e-97ab-f870e968c8a7"}	\N	node	2026-06-18 20:22:06.828178+00
124	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "aa747ae6-8cd3-41b2-ac13-ed98f99335f3", "old_session": "0ab38c89-32d8-4237-a699-d007a9df4e5d"}	\N	node	2026-06-18 20:28:06.67274+00
125	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "7e11ad53-dd0d-4b54-b11c-781c171152d8", "old_session": "aa747ae6-8cd3-41b2-ac13-ed98f99335f3"}	\N	node	2026-06-18 20:38:51.009943+00
126	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "fa105eed-ff50-41d2-aa93-350848339e11", "old_session": "7e11ad53-dd0d-4b54-b11c-781c171152d8"}	\N	node	2026-06-18 20:41:26.485522+00
127	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f01e1ae2-c0fd-4e5c-a533-57e8d9eb901a", "old_session": "fa105eed-ff50-41d2-aa93-350848339e11"}	\N	node	2026-06-18 20:53:27.728264+00
128	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ede1f786-b149-42bc-aca4-9886b001bc7c", "old_session": "f01e1ae2-c0fd-4e5c-a533-57e8d9eb901a"}	\N	node	2026-06-18 20:53:57.706555+00
129	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "003f35b4-0275-4510-92fe-fdc04f635993", "old_session": "0429fd68-b094-4352-8628-21f54fdb38a2"}	\N	node	2026-06-18 20:57:30.715387+00
130	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "17d1026c-4948-4abf-97b2-23900b815e07", "old_session": "ede1f786-b149-42bc-aca4-9886b001bc7c"}	\N	node	2026-06-18 21:00:18.136516+00
131	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "45aa7e5a-2c2b-4803-b56d-acf099872e2a", "old_session": "17d1026c-4948-4abf-97b2-23900b815e07"}	\N	node	2026-06-18 21:05:37.986105+00
132	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "48d5caa8-b2cb-426e-9adb-5457915b6317", "old_session": "45aa7e5a-2c2b-4803-b56d-acf099872e2a"}	\N	node	2026-06-18 21:41:55.499405+00
133	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "9f61d63f-e882-4e3f-95bc-e62f24f5ef22", "old_session": "48d5caa8-b2cb-426e-9adb-5457915b6317"}	\N	node	2026-06-18 22:00:57.4489+00
134	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "fae7b1d9-d3a7-4d79-b8b0-e9ff4b0a2cee", "old_session": "003f35b4-0275-4510-92fe-fdc04f635993"}	\N	node	2026-06-18 22:03:52.037284+00
135	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "fd8459ef-a543-4ade-bf8a-c0b1bb3c5d3d", "old_session": "9f61d63f-e882-4e3f-95bc-e62f24f5ef22"}	\N	node	2026-06-18 22:05:50.333702+00
136	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "0e60f020-6c17-4b69-afc9-ec924dc2d463", "old_session": "fd8459ef-a543-4ade-bf8a-c0b1bb3c5d3d"}	\N	node	2026-06-18 22:42:53.467822+00
137	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "bde148f4-37b3-4763-a7ed-c4bb50c8ace1", "old_session": "0e60f020-6c17-4b69-afc9-ec924dc2d463"}	\N	node	2026-06-18 23:01:50.139819+00
138	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8b024649-b9a5-4b38-b616-afd9aaa808b0", "old_session": "bde148f4-37b3-4763-a7ed-c4bb50c8ace1"}	\N	node	2026-06-18 23:06:50.2047+00
139	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "5127e985-4ee7-4e90-90c9-fb50c01addd8", "old_session": "fae7b1d9-d3a7-4d79-b8b0-e9ff4b0a2cee"}	\N	node	2026-06-18 23:18:58.922911+00
140	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "d8f0a85e-a899-4629-9299-d20427c1336a", "old_session": "8b024649-b9a5-4b38-b616-afd9aaa808b0"}	\N	node	2026-06-18 23:21:09.158463+00
141	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "e80cc9fb-3df8-447c-8d7b-1220b0a7e5d3", "old_session": "d8f0a85e-a899-4629-9299-d20427c1336a"}	\N	node	2026-06-18 23:24:39.948515+00
142	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "aa4d4ae9-4185-4431-bf11-5b85df5f530b", "old_session": "e80cc9fb-3df8-447c-8d7b-1220b0a7e5d3"}	\N	node	2026-06-18 23:32:13.857324+00
143	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "28465de5-bcbb-496c-b3d0-d63a85b7accd", "old_session": "aa4d4ae9-4185-4431-bf11-5b85df5f530b"}	\N	node	2026-06-18 23:32:22.709146+00
144	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "dc220f72-2087-4678-837b-97dbe2fee085", "old_session": "28465de5-bcbb-496c-b3d0-d63a85b7accd"}	\N	node	2026-06-18 23:33:45.069382+00
145	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "2088e4e9-3333-407c-871d-c44868c9d757", "old_session": "dc220f72-2087-4678-837b-97dbe2fee085"}	\N	node	2026-06-18 23:43:50.579062+00
146	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c318d645-3222-4fa1-82f5-80c4e41da506", "old_session": "2088e4e9-3333-407c-871d-c44868c9d757"}	\N	node	2026-06-18 23:49:33.407988+00
147	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "12cc7062-2348-4b90-9c39-975fb1946014", "old_session": "c318d645-3222-4fa1-82f5-80c4e41da506"}	\N	node	2026-06-18 23:49:53.95773+00
148	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1a00d3d9-3c54-4033-82d1-24b0008622c0", "old_session": "12cc7062-2348-4b90-9c39-975fb1946014"}	\N	node	2026-06-18 23:52:38.050019+00
149	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1addfde5-bfde-4691-b528-cc1c43e62b9d", "old_session": "1a00d3d9-3c54-4033-82d1-24b0008622c0"}	\N	node	2026-06-18 23:55:47.683466+00
150	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "e0f920f2-e6f7-47bd-b2a0-34b92d79c7c3", "old_session": "1addfde5-bfde-4691-b528-cc1c43e62b9d"}	\N	node	2026-06-19 00:01:51.395155+00
153	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	user	oauth.google.login.success	{"email": "prestasiproperty7@gmail.com", "provider": "google", "provider_user_id": "109091404271703494939"}	\N	node	2026-06-19 00:01:59.608132+00
151	\N	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	users	INSERT	{"new": {"id": "c8a11d02-d8bf-40b8-b54e-92909c3df8fd", "email": "prestasiproperty7@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-19T00:01:59.244521+00:00", "deleted_at": null, "updated_at": "2026-06-19T00:01:59.244521+00:00", "updated_by": null, "last_login_at": "2026-06-19T00:01:59.244521+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-19T00:01:59.244521+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-19 00:01:59.244521+00
152	\N	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	user_profiles	INSERT	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "user_id": "c8a11d02-d8bf-40b8-b54e-92909c3df8fd", "location": null, "metadata": {"google": {"name": "PRESTASI PROPERTY", "email": "prestasiproperty7@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "email_verified": true, "provider_user_id": "109091404271703494939"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "auth_provider": "google"}, "username": "prestasiproperty", "birthdate": null, "full_name": "PRESTASI PROPERTY", "created_at": "2026-06-19T00:01:59.426932+00:00", "search_tsv": "'prestasi':1 'property':2", "updated_at": "2026-06-19T00:01:59.426932+00:00"}}	\N	\N	2026-06-19 00:01:59.426932+00
154	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	user	token.rotate	{"new_session": "09eed428-536a-450a-a6af-85a54319a3f6", "old_session": "39ffefac-1bfb-4936-ad51-ff852fa753ec"}	\N	node	2026-06-19 00:02:01.387007+00
155	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "d619f6c0-da36-4725-80c0-4b87271eb3dc", "old_session": "5127e985-4ee7-4e90-90c9-fb50c01addd8"}	\N	node	2026-06-19 00:02:17.790699+00
156	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "45c09062-6336-4c64-abeb-2cd2416c25b6", "old_session": "e0f920f2-e6f7-47bd-b2a0-34b92d79c7c3"}	\N	node	2026-06-19 00:02:30.303755+00
157	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "ce3dca1b-88ba-43bc-ba92-ec3fb1ef35c5", "old_session": "d619f6c0-da36-4725-80c0-4b87271eb3dc"}	\N	node	2026-06-19 00:04:48.093681+00
158	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "2db7d75f-8b5d-4264-bb80-23c0caceb82d", "old_session": "ce3dca1b-88ba-43bc-ba92-ec3fb1ef35c5"}	\N	node	2026-06-19 00:06:33.513879+00
159	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "12fbd942-85fc-471d-be5a-ff6af89af9ec", "old_session": "2db7d75f-8b5d-4264-bb80-23c0caceb82d"}	\N	node	2026-06-19 00:06:51.429304+00
160	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "be5e701f-64f6-4a2e-9aef-0094cc84cb64", "old_session": "12fbd942-85fc-471d-be5a-ff6af89af9ec"}	\N	node	2026-06-19 00:07:23.294321+00
161	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "f7ff61d4-2cb4-4b89-bf5e-1c0652e109b5", "old_session": "be5e701f-64f6-4a2e-9aef-0094cc84cb64"}	\N	node	2026-06-19 00:07:25.757222+00
162	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "c70e0abe-2bdc-4445-a753-39e05cead5d3", "old_session": "f7ff61d4-2cb4-4b89-bf5e-1c0652e109b5"}	\N	node	2026-06-19 00:07:34.722759+00
163	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "5b498ed6-6b33-4861-994c-e2786d8d6242", "old_session": "c70e0abe-2bdc-4445-a753-39e05cead5d3"}	\N	node	2026-06-19 00:08:18.068298+00
164	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "988e6448-146d-4475-8553-4b2df2aa7ad3", "old_session": "5b498ed6-6b33-4861-994c-e2786d8d6242"}	\N	node	2026-06-19 00:09:02.590032+00
165	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "76334cf1-ca36-49c5-bc6c-46debaed9972", "old_session": "45c09062-6336-4c64-abeb-2cd2416c25b6"}	\N	node	2026-06-19 00:11:07.576162+00
166	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "240bc359-2bf7-418e-8793-267c10ef80f5", "old_session": "76334cf1-ca36-49c5-bc6c-46debaed9972"}	\N	node	2026-06-19 00:11:20.634112+00
167	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "fca2bf4b-5e6b-4671-bfa7-624f2b0a2673", "old_session": "240bc359-2bf7-418e-8793-267c10ef80f5"}	\N	node	2026-06-19 00:13:10.014371+00
168	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c8375093-bf93-4898-b969-f38e968af397", "old_session": "fca2bf4b-5e6b-4671-bfa7-624f2b0a2673"}	\N	node	2026-06-19 00:14:56.502621+00
169	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "66829ad1-00bf-40ab-acd6-84ea08ebfbcc", "old_session": "c8375093-bf93-4898-b969-f38e968af397"}	\N	node	2026-06-19 00:15:22.428933+00
170	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "ac2320ce-1466-4909-8fa6-7340ebf09c43", "old_session": "988e6448-146d-4475-8553-4b2df2aa7ad3"}	\N	node	2026-06-19 00:16:47.362999+00
171	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c6dcf730-c03b-4d3f-a435-6891f8a45f0e", "old_session": "66829ad1-00bf-40ab-acd6-84ea08ebfbcc"}	\N	node	2026-06-19 00:44:52.911288+00
172	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ca61cdc6-d5da-4978-b5df-6e2ff68c68fc", "old_session": "c6dcf730-c03b-4d3f-a435-6891f8a45f0e"}	\N	node	2026-06-19 00:45:59.551166+00
173	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "e9756915-c37d-4625-8ec8-b619645badc7", "old_session": "ca61cdc6-d5da-4978-b5df-6e2ff68c68fc"}	\N	node	2026-06-19 00:46:02.014043+00
174	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "2c035278-dc94-4547-9f6d-4dfe97ca040b", "old_session": "e9756915-c37d-4625-8ec8-b619645badc7"}	\N	node	2026-06-19 00:46:39.509584+00
175	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "0193f6e0-243d-4ade-ac9b-0a4a8efb58ee", "old_session": "ac2320ce-1466-4909-8fa6-7340ebf09c43"}	\N	node	2026-06-19 00:54:13.975862+00
176	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "35bd5e10-0b88-425d-bed7-69afb8ae0075", "old_session": "0193f6e0-243d-4ade-ac9b-0a4a8efb58ee"}	\N	node	2026-06-19 00:54:27.360353+00
177	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "9e3c0909-6f4d-47b0-bc29-d72823066f4f", "old_session": "35bd5e10-0b88-425d-bed7-69afb8ae0075"}	\N	node	2026-06-19 00:54:33.385051+00
178	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "4f97560f-bd34-4248-ae0d-d140f88075bd", "old_session": "9e3c0909-6f4d-47b0-bc29-d72823066f4f"}	\N	node	2026-06-19 00:54:41.78417+00
179	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "d7927665-1624-474f-b836-fea304dc8105", "old_session": "4f97560f-bd34-4248-ae0d-d140f88075bd"}	\N	node	2026-06-19 00:54:51.432761+00
180	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "3d2f11e8-1177-4a53-b436-002b374db307", "old_session": "2c035278-dc94-4547-9f6d-4dfe97ca040b"}	\N	node	2026-06-19 00:55:49.359189+00
181	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "51bd32f3-a449-4814-ae7e-48579c246c4a", "old_session": "3d2f11e8-1177-4a53-b436-002b374db307"}	\N	node	2026-06-19 01:11:49.289347+00
182	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "a64307c7-6ec5-4f15-9e5b-4c61c8493950", "old_session": "51bd32f3-a449-4814-ae7e-48579c246c4a"}	\N	node	2026-06-19 01:45:49.398281+00
183	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "19640f3a-8389-4e43-a2f4-1ca46e2d7e29", "old_session": "a64307c7-6ec5-4f15-9e5b-4c61c8493950"}	\N	node	2026-06-19 01:46:40.100441+00
184	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "3ab03375-660f-4e8b-b681-6f73c1195d37", "old_session": "19640f3a-8389-4e43-a2f4-1ca46e2d7e29"}	\N	node	2026-06-19 01:55:49.317665+00
185	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "0c26af27-ba09-47a1-96a6-667181b833a7", "old_session": "3ab03375-660f-4e8b-b681-6f73c1195d37"}	\N	node	2026-06-19 02:11:49.265857+00
186	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "268fd58d-78ad-435e-92cd-d9682cebfa57", "old_session": "0c26af27-ba09-47a1-96a6-667181b833a7"}	\N	node	2026-06-19 02:45:49.294766+00
187	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f13fbaf8-58ac-469d-bba2-05d5b2902620", "old_session": "268fd58d-78ad-435e-92cd-d9682cebfa57"}	\N	node	2026-06-19 02:46:40.373279+00
188	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6da56863-d28d-4c9e-b0a1-b37d8eee139f", "old_session": "f13fbaf8-58ac-469d-bba2-05d5b2902620"}	\N	node	2026-06-19 02:55:49.228432+00
189	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "cb3d58e7-90bd-42b9-8d80-b8bd05ae8b23", "old_session": "6da56863-d28d-4c9e-b0a1-b37d8eee139f"}	\N	node	2026-06-19 03:11:49.298025+00
190	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "0996377d-4219-4b84-9982-e7046d21cdcf", "old_session": "cb3d58e7-90bd-42b9-8d80-b8bd05ae8b23"}	\N	node	2026-06-19 03:45:51.447759+00
191	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "db7be05c-0a15-4446-ada9-b2ba01c74ace", "old_session": "0996377d-4219-4b84-9982-e7046d21cdcf"}	\N	node	2026-06-19 03:46:40.717066+00
192	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "aaf047fb-45d3-4531-9d71-2ece994e252e", "old_session": "db7be05c-0a15-4446-ada9-b2ba01c74ace"}	\N	node	2026-06-19 03:50:37.643241+00
193	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "2a214b87-fce0-40a7-9a68-d0b202a6bffd", "old_session": "aaf047fb-45d3-4531-9d71-2ece994e252e"}	\N	node	2026-06-19 03:55:49.481231+00
194	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "aedab471-dbb5-4c90-a043-26beff0fc4de", "old_session": "2a214b87-fce0-40a7-9a68-d0b202a6bffd"}	\N	node	2026-06-19 03:59:55.22032+00
195	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "995dc65d-302d-4813-9061-78032b3d1d23", "old_session": "aedab471-dbb5-4c90-a043-26beff0fc4de"}	\N	node	2026-06-19 04:05:27.651825+00
196	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "272dacde-6986-415d-bf1e-1d301b8ecbf6", "old_session": "995dc65d-302d-4813-9061-78032b3d1d23"}	\N	node	2026-06-19 04:09:18.956347+00
197	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "86f45b46-cbcb-42ed-9459-0c23eb608548", "old_session": "272dacde-6986-415d-bf1e-1d301b8ecbf6"}	\N	node	2026-06-19 04:20:56.028696+00
198	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8cb34808-d4b7-4771-a673-6b7c350217cd", "old_session": "86f45b46-cbcb-42ed-9459-0c23eb608548"}	\N	node	2026-06-19 04:21:23.268782+00
199	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6427f1d0-5d93-47d6-a2a3-7a2de631f007", "old_session": "8cb34808-d4b7-4771-a673-6b7c350217cd"}	\N	node	2026-06-19 04:25:19.656978+00
200	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "85963e39-6fd9-4cd6-a176-0207c9afd740", "old_session": "6427f1d0-5d93-47d6-a2a3-7a2de631f007"}	\N	node	2026-06-19 04:25:25.551473+00
201	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "7a6eb8f8-cd61-49b8-8489-aacf5aaa4043", "old_session": "85963e39-6fd9-4cd6-a176-0207c9afd740"}	\N	node	2026-06-19 04:27:18.5378+00
202	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "34d407c6-9ce5-4ed4-ad40-0f05345fe243", "old_session": "7a6eb8f8-cd61-49b8-8489-aacf5aaa4043"}	\N	node	2026-06-19 04:30:34.175257+00
203	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8e49f085-32db-4b92-bda1-75b77716b9fb", "old_session": "34d407c6-9ce5-4ed4-ad40-0f05345fe243"}	\N	node	2026-06-19 05:04:02.680118+00
204	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "09f46666-76fd-44cb-bce6-35ceb21a550f", "old_session": "8e49f085-32db-4b92-bda1-75b77716b9fb"}	\N	node	2026-06-19 05:12:16.401545+00
205	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6d95ba3c-e30f-40a4-88b0-8b428353bdb3", "old_session": "09f46666-76fd-44cb-bce6-35ceb21a550f"}	\N	node	2026-06-19 05:12:22.167317+00
206	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "a1bbf2b2-847f-4714-9fc6-750fc62e2e4f", "old_session": "6d95ba3c-e30f-40a4-88b0-8b428353bdb3"}	\N	node	2026-06-19 05:12:50.836753+00
207	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "285fd41a-ddc1-4bbb-bd12-31044bfc2628", "old_session": "a1bbf2b2-847f-4714-9fc6-750fc62e2e4f"}	\N	node	2026-06-19 05:14:05.134713+00
208	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "a51d4181-eadb-4d23-8285-84914d53de98", "old_session": "d7927665-1624-474f-b836-fea304dc8105"}	\N	node	2026-06-19 06:05:49.353853+00
209	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8df2448f-c681-4ae5-9cdc-b107d016a1f3", "old_session": "285fd41a-ddc1-4bbb-bd12-31044bfc2628"}	\N	node	2026-06-19 06:14:07.70849+00
210	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "bd9fae7a-2f95-421a-9f08-1fb6f1355984", "old_session": "8df2448f-c681-4ae5-9cdc-b107d016a1f3"}	\N	node	2026-06-19 06:25:20.072851+00
211	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ee473f95-c879-4260-a9f7-28318f7c1f29", "old_session": "bd9fae7a-2f95-421a-9f08-1fb6f1355984"}	\N	node	2026-06-19 06:42:56.198952+00
212	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "7f4e2592-2122-4b43-9817-76bad418d330", "old_session": "ee473f95-c879-4260-a9f7-28318f7c1f29"}	\N	node	2026-06-19 06:44:23.656165+00
213	\N	\N	user	token.refresh_failed	{"session": "ee473f95-c879-4260-a9f7-28318f7c1f29"}	\N	node	2026-06-19 06:44:26.565236+00
296	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "d5da9e64-d0c9-4084-bbb5-8f5da648b9ba", "old_session": "1f111609-4bc1-4c4b-9fcf-dd34aa538e59"}	\N	node	2026-06-21 23:48:36.582226+00
214	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	users	UPDATE	{"new": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-19T07:19:43.409581+00:00", "updated_by": null, "last_login_at": "2026-06-19T07:19:43.409581+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "old": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-18T15:24:37.237155+00:00", "updated_by": null, "last_login_at": "2026-06-18T15:24:37.237155+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-19 07:19:43.409581+00
215	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user_profiles	UPDATE	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-19T07:19:43.590808+00:00"}, "old": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-18T15:24:37.304093+00:00"}}	\N	\N	2026-06-19 07:19:43.590808+00
216	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	oauth.google.login.success	{"email": "fauzanyanuarp@gmail.com", "provider": "google", "provider_user_id": "105685214361219477879"}	\N	node	2026-06-19 07:19:50.633957+00
217	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c449b20e-313e-4600-9190-9e897b332e45", "old_session": "40ea9443-8bd1-4424-a864-9a5656c9b6d0"}	\N	node	2026-06-19 07:20:04.770504+00
218	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "04597ec9-c1d1-4685-8ec9-0f3612fb6e30", "old_session": "a51d4181-eadb-4d23-8285-84914d53de98"}	\N	node	2026-06-19 07:22:27.851083+00
219	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "a2d03372-3882-458d-900a-474d508b9410", "old_session": "04597ec9-c1d1-4685-8ec9-0f3612fb6e30"}	\N	node	2026-06-19 07:22:34.671153+00
220	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "a1f465e4-9f6c-4df6-b3f0-e10e87bb2643", "old_session": "a2d03372-3882-458d-900a-474d508b9410"}	\N	node	2026-06-19 07:22:57.224473+00
221	\N	\N	user	logout	{"session": "a1f465e4-9f6c-4df6-b3f0-e10e87bb2643"}	\N	node	2026-06-19 07:23:03.61012+00
222	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ecc54dd9-59ed-4f99-97d8-aec613a697de", "old_session": "c449b20e-313e-4600-9190-9e897b332e45"}	\N	node	2026-06-19 07:25:28.861851+00
223	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "e20d6863-971e-4253-9dfc-7a3b2276988e", "old_session": "ecc54dd9-59ed-4f99-97d8-aec613a697de"}	\N	node	2026-06-19 08:25:52.653889+00
224	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ca031cea-7387-4569-997e-ca2c3d69e2b1", "old_session": "e20d6863-971e-4253-9dfc-7a3b2276988e"}	\N	node	2026-06-19 08:48:50.049521+00
225	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "697a4575-9063-4d90-9c68-942269b5069c", "old_session": "ca031cea-7387-4569-997e-ca2c3d69e2b1"}	\N	node	2026-06-19 09:16:30.265388+00
226	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "58c8c131-4616-4f11-aab8-6117e21ae8bf", "old_session": "697a4575-9063-4d90-9c68-942269b5069c"}	\N	node	2026-06-19 09:38:35.168817+00
227	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1a84e6ed-2ce7-4584-a7b9-24bff90f619a", "old_session": "58c8c131-4616-4f11-aab8-6117e21ae8bf"}	\N	node	2026-06-19 09:39:19.72121+00
228	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1c8bcf13-bf1e-47a8-8106-9418c62d9bd5", "old_session": "1a84e6ed-2ce7-4584-a7b9-24bff90f619a"}	\N	node	2026-06-19 09:43:24.964327+00
229	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "e1222bbd-66ef-4865-8290-ce256c5f6784", "old_session": "1c8bcf13-bf1e-47a8-8106-9418c62d9bd5"}	\N	node	2026-06-19 10:43:30.089367+00
230	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	users	UPDATE	{"new": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-19T11:18:13.81807+00:00", "updated_by": null, "last_login_at": "2026-06-19T11:18:13.81807+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "old": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-19T07:19:43.409581+00:00", "updated_by": null, "last_login_at": "2026-06-19T07:19:43.409581+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-19 11:18:13.81807+00
297	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6d56f61d-bb99-466e-855e-e86fc017fd6f", "old_session": "d5da9e64-d0c9-4084-bbb5-8f5da648b9ba"}	\N	node	2026-06-22 00:17:35.478221+00
231	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user_profiles	UPDATE	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-19T11:18:13.938928+00:00"}, "old": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-19T07:19:43.590808+00:00"}}	\N	\N	2026-06-19 11:18:13.938928+00
232	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	oauth.google.login.success	{"email": "fauzanyanuarp@gmail.com", "provider": "google", "provider_user_id": "105685214361219477879"}	\N	node	2026-06-19 11:18:17.644113+00
233	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "b41054f7-dcdd-4757-8d9e-4ef3cb11508f", "old_session": "1ca1efa1-cd46-4d97-b554-13f1d5e6aa15"}	\N	node	2026-06-19 11:18:20.079886+00
234	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8c172a1a-7883-42d3-b9b5-567816e5d198", "old_session": "b41054f7-dcdd-4757-8d9e-4ef3cb11508f"}	\N	node	2026-06-19 11:18:44.515187+00
235	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "7089f237-99c5-4383-99f4-441c8f6efa5f", "old_session": "e1222bbd-66ef-4865-8290-ce256c5f6784"}	\N	node	2026-06-19 11:24:45.876106+00
236	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "bb09c57b-8f84-430e-8eb6-1175a11d436b", "old_session": "7089f237-99c5-4383-99f4-441c8f6efa5f"}	\N	node	2026-06-19 11:56:50.082529+00
237	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1b1c139d-e4be-4e19-a305-65f2d9f3e655", "old_session": "bb09c57b-8f84-430e-8eb6-1175a11d436b"}	\N	node	2026-06-19 11:56:58.894724+00
238	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "b7e9a6bc-41fb-4c5c-a18e-5643f2218d0e", "old_session": "8c172a1a-7883-42d3-b9b5-567816e5d198"}	\N	node	2026-06-19 12:25:16.506791+00
239	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "4a72efdb-d2b2-4e6d-b2a4-392c92f1af94", "old_session": "b7e9a6bc-41fb-4c5c-a18e-5643f2218d0e"}	\N	node	2026-06-19 12:25:42.651944+00
240	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "a6e480e4-c832-4a3b-bfd8-449889ef48e4", "old_session": "4a72efdb-d2b2-4e6d-b2a4-392c92f1af94"}	\N	node	2026-06-19 12:26:02.553784+00
241	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "fc52fa18-4ae6-4f89-b6c4-4f77e86207ef", "old_session": "a6e480e4-c832-4a3b-bfd8-449889ef48e4"}	\N	node	2026-06-19 12:26:41.755843+00
242	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f9eeb080-2f4c-449c-aaf6-bf73b99ac3b3", "old_session": "fc52fa18-4ae6-4f89-b6c4-4f77e86207ef"}	\N	node	2026-06-19 12:26:44.96436+00
243	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "61405fe4-4ae7-4866-905f-2535a3d391fb", "old_session": "f9eeb080-2f4c-449c-aaf6-bf73b99ac3b3"}	\N	node	2026-06-19 12:26:47.770112+00
244	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1fddcc3c-9255-49fb-8e85-f7ef90d25002", "old_session": "61405fe4-4ae7-4866-905f-2535a3d391fb"}	\N	node	2026-06-19 12:26:56.152604+00
245	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f5f120c3-c1ff-4284-86fb-66c330e44e72", "old_session": "1b1c139d-e4be-4e19-a305-65f2d9f3e655"}	\N	node	2026-06-19 12:57:07.774043+00
246	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "50928cec-aa4e-4399-a4fe-0c7855a9c5bc", "old_session": "f5f120c3-c1ff-4284-86fb-66c330e44e72"}	\N	node	2026-06-19 13:54:30.254509+00
247	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "75b9277c-5c4d-4249-bda5-00444901fcb3", "old_session": "f5f120c3-c1ff-4284-86fb-66c330e44e72"}	\N	node	2026-06-19 13:54:42.6731+00
248	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "c4539a63-d7e6-4a13-87e3-dccace68908a", "old_session": "1fddcc3c-9255-49fb-8e85-f7ef90d25002"}	\N	node	2026-06-19 14:02:00.534979+00
249	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "a5c1679c-4a5a-4be3-bb88-9b3443982d06", "old_session": "6fb5637c-1463-4176-8863-da115f8439d7"}	\N	node	2026-06-19 14:02:58.265068+00
250	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "9e03b0fd-0194-4a59-8f20-9a5285539d6a", "old_session": "c4539a63-d7e6-4a13-87e3-dccace68908a"}	\N	node	2026-06-19 14:03:24.638612+00
251	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "047872b9-a029-42c8-b7b9-febcf9b63876", "old_session": "a5c1679c-4a5a-4be3-bb88-9b3443982d06"}	\N	node	2026-06-19 14:03:35.228264+00
252	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f6e9e72e-7e6f-40f4-a910-de1977b2d15f", "old_session": "9e03b0fd-0194-4a59-8f20-9a5285539d6a"}	\N	node	2026-06-19 14:03:47.459456+00
253	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6ab10129-4b74-4a28-9979-5f7416706cfe", "old_session": "9e03b0fd-0194-4a59-8f20-9a5285539d6a"}	\N	node	2026-06-19 14:03:49.229781+00
254	\N	\N	user	logout	{"session": "6ab10129-4b74-4a28-9979-5f7416706cfe"}	\N	node	2026-06-19 14:03:57.589658+00
255	\N	1747f31a-2972-4506-b997-1c03eb38aa6e	users	UPDATE	{"new": {"id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "email": "muhzannzs@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:44:15.592824+00:00", "deleted_at": null, "updated_at": "2026-06-19T14:04:27.174923+00:00", "updated_by": null, "last_login_at": "2026-06-19T14:04:27.174923+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:44:15.592824+00:00", "failed_login_attempts": 0}, "old": {"id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "email": "muhzannzs@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:44:15.592824+00:00", "deleted_at": null, "updated_at": "2026-06-18T12:44:15.592824+00:00", "updated_by": null, "last_login_at": "2026-06-18T12:44:15.592824+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:44:15.592824+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-19 14:04:27.174923+00
258	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "608f5e83-5eed-4c66-b23c-9d4de3c0fbb0", "old_session": "6fd462a6-60e8-4700-93a0-be2608eda6c9"}	\N	node	2026-06-19 14:04:33.792123+00
259	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "25f13989-a48a-408d-913a-80a98b48efc5", "old_session": "608f5e83-5eed-4c66-b23c-9d4de3c0fbb0"}	\N	node	2026-06-19 14:05:12.538465+00
261	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "ab04ec31-6142-4ed2-8c45-8c47e7509551", "old_session": "25f13989-a48a-408d-913a-80a98b48efc5"}	\N	node	2026-06-19 14:06:14.803019+00
256	\N	1747f31a-2972-4506-b997-1c03eb38aa6e	user_profiles	UPDATE	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "location": null, "metadata": {"google": {"name": "Fauzan", "email": "muhzannzs@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "email_verified": true, "provider_user_id": "104705709147742782273"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "auth_provider": "google"}, "username": "fauzan", "birthdate": null, "full_name": "Fauzan", "created_at": "2026-06-18T12:44:15.638151+00:00", "search_tsv": "'fauzan':1", "updated_at": "2026-06-19T14:04:27.480035+00:00"}, "old": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "location": null, "metadata": {"google": {"name": "Fauzan", "email": "muhzannzs@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "email_verified": true, "provider_user_id": "104705709147742782273"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "auth_provider": "google"}, "username": "fauzan", "birthdate": null, "full_name": "Fauzan", "created_at": "2026-06-18T12:44:15.638151+00:00", "search_tsv": "'fauzan':1", "updated_at": "2026-06-18T12:44:15.638151+00:00"}}	\N	\N	2026-06-19 14:04:27.480035+00
257	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	oauth.google.login.success	{"email": "muhzannzs@gmail.com", "provider": "google", "provider_user_id": "104705709147742782273"}	\N	node	2026-06-19 14:04:28.198826+00
260	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	user	token.rotate	{"new_session": "e152a3a7-0765-4851-b774-59ed7363704b", "old_session": "047872b9-a029-42c8-b7b9-febcf9b63876"}	\N	node	2026-06-19 14:05:54.078986+00
262	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "cb8a3a3c-31e8-4015-9364-c5ac7bc7c775", "old_session": "ab04ec31-6142-4ed2-8c45-8c47e7509551"}	\N	node	2026-06-19 14:07:05.583552+00
263	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "10e44d8c-698a-4643-b312-114856d54055", "old_session": "50928cec-aa4e-4399-a4fe-0c7855a9c5bc"}	\N	node	2026-06-20 05:38:56.102302+00
264	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	users	UPDATE	{"new": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-20T05:39:05.630807+00:00", "updated_by": null, "last_login_at": "2026-06-20T05:39:05.630807+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "old": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-19T11:18:13.81807+00:00", "updated_by": null, "last_login_at": "2026-06-19T11:18:13.81807+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-20 05:39:05.630807+00
265	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user_profiles	UPDATE	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-20T05:39:05.699434+00:00"}, "old": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-19T11:18:13.938928+00:00"}}	\N	\N	2026-06-20 05:39:05.699434+00
266	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	oauth.google.login.success	{"email": "fauzanyanuarp@gmail.com", "provider": "google", "provider_user_id": "105685214361219477879"}	\N	node	2026-06-20 05:39:05.94645+00
267	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ad6dcfb7-7952-4313-9c6e-04f5f867ed6b", "old_session": "eb80ea22-c179-460a-9da8-a171168d6e7d"}	\N	node	2026-06-20 05:39:09.224895+00
268	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "eae5aa66-4fa1-4971-a76d-7094a6cfbee4", "old_session": "ad6dcfb7-7952-4313-9c6e-04f5f867ed6b"}	\N	node	2026-06-20 05:39:16.610997+00
269	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "ee0e69dd-aba1-4ee5-b17e-1046b74b34d5", "old_session": "eae5aa66-4fa1-4971-a76d-7094a6cfbee4"}	\N	node	2026-06-20 05:40:22.918265+00
270	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1d17f370-f5e1-4a7f-b9cf-e314dec3a193", "old_session": "ee0e69dd-aba1-4ee5-b17e-1046b74b34d5"}	\N	node	2026-06-20 21:03:37.781947+00
271	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "82bea9ce-1802-482f-ab9b-e4774757d749", "old_session": "1d17f370-f5e1-4a7f-b9cf-e314dec3a193"}	\N	node	2026-06-21 18:09:20.608334+00
272	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	users	UPDATE	{"new": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-21T22:29:36.090017+00:00", "updated_by": null, "last_login_at": "2026-06-21T22:29:36.090017+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "old": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-20T05:39:05.630807+00:00", "updated_by": null, "last_login_at": "2026-06-20T05:39:05.630807+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}}	\N	\N	2026-06-21 22:29:36.090017+00
273	\N	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user_profiles	UPDATE	{"new": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-21T22:29:36.17092+00:00"}, "old": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-20T05:39:05.699434+00:00"}}	\N	\N	2026-06-21 22:29:36.17092+00
274	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	oauth.google.login.success	{"email": "fauzanyanuarp@gmail.com", "provider": "google", "provider_user_id": "105685214361219477879"}	\N	node	2026-06-21 22:29:37.547737+00
275	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "4cab92d6-000b-46b1-8103-a4f2a54efa20", "old_session": "2a0b8739-3fd6-4959-be47-b579f92c1e9c"}	\N	node	2026-06-21 22:29:39.821296+00
276	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "0f678230-fbd1-4e7d-bf20-2ee380681f60", "old_session": "4cab92d6-000b-46b1-8103-a4f2a54efa20"}	\N	node	2026-06-21 22:29:45.646749+00
277	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "11affdc0-f5b4-4ac5-a089-a00eeac78e6b", "old_session": "0f678230-fbd1-4e7d-bf20-2ee380681f60"}	\N	node	2026-06-21 22:37:08.824604+00
278	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "cd19f4cc-81f5-433f-bafb-9da00582b161", "old_session": "11affdc0-f5b4-4ac5-a089-a00eeac78e6b"}	\N	node	2026-06-21 22:38:13.816414+00
279	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "2723bbcd-a906-48bd-b932-27b847cb09e7", "old_session": "cd19f4cc-81f5-433f-bafb-9da00582b161"}	\N	node	2026-06-21 22:39:53.882178+00
280	1747f31a-2972-4506-b997-1c03eb38aa6e	1747f31a-2972-4506-b997-1c03eb38aa6e	user	token.rotate	{"new_session": "4ca1bd6d-e795-4dbe-aefa-5a8a8f633aa3", "old_session": "cb8a3a3c-31e8-4015-9364-c5ac7bc7c775"}	\N	node	2026-06-21 22:42:40.158172+00
281	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8325f235-b3a4-491d-9055-43c83e11fbfe", "old_session": "2723bbcd-a906-48bd-b932-27b847cb09e7"}	\N	node	2026-06-21 22:43:16.762168+00
282	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "e82fd0d7-39d9-401b-b115-d7c93314b482", "old_session": "8325f235-b3a4-491d-9055-43c83e11fbfe"}	\N	node	2026-06-21 22:43:18.641276+00
283	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "6e091ffc-dd1a-4e27-8aac-34a3b322cd2b", "old_session": "e82fd0d7-39d9-401b-b115-d7c93314b482"}	\N	node	2026-06-21 22:43:44.572425+00
284	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "0e2ea54a-4c30-466c-99a7-bfcbe29d794b", "old_session": "6e091ffc-dd1a-4e27-8aac-34a3b322cd2b"}	\N	node	2026-06-21 22:43:55.420592+00
285	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f460b29f-1580-4519-b7a9-3119c7725e1d", "old_session": "0e2ea54a-4c30-466c-99a7-bfcbe29d794b"}	\N	node	2026-06-21 22:45:13.280967+00
286	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "edf05c40-d8e7-4719-956e-60ac3800b6f6", "old_session": "f460b29f-1580-4519-b7a9-3119c7725e1d"}	\N	node	2026-06-21 22:45:17.749411+00
287	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "f336e813-8e47-4ad8-a89f-6a10d6e4e954", "old_session": "edf05c40-d8e7-4719-956e-60ac3800b6f6"}	\N	node	2026-06-21 22:46:03.236596+00
288	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "60f90dd2-2d46-4874-a6a2-31f95a2b7325", "old_session": "f336e813-8e47-4ad8-a89f-6a10d6e4e954"}	\N	node	2026-06-21 22:48:54.015065+00
289	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "83648a6b-11e1-40b2-8ca7-76b2f9de58b8", "old_session": "60f90dd2-2d46-4874-a6a2-31f95a2b7325"}	\N	node	2026-06-21 22:52:48.377756+00
290	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "9649073d-f28d-40c6-9ec0-3ce07b09849b", "old_session": "83648a6b-11e1-40b2-8ca7-76b2f9de58b8"}	\N	node	2026-06-21 22:53:03.298171+00
291	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "378f742d-1205-4285-b8d2-2d630ec1890e", "old_session": "9649073d-f28d-40c6-9ec0-3ce07b09849b"}	\N	node	2026-06-21 22:53:19.655994+00
292	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "de872611-fc35-4224-93f9-1e9fb1963b57", "old_session": "378f742d-1205-4285-b8d2-2d630ec1890e"}	\N	node	2026-06-21 23:06:39.38986+00
293	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "8fde0673-1e9f-42f0-b6ef-8077d8c3707d", "old_session": "de872611-fc35-4224-93f9-1e9fb1963b57"}	\N	node	2026-06-21 23:07:13.903722+00
294	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "4a5827a1-30b5-4baa-8541-223de8a3f8c8", "old_session": "8fde0673-1e9f-42f0-b6ef-8077d8c3707d"}	\N	node	2026-06-21 23:07:16.783151+00
295	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	user	token.rotate	{"new_session": "1f111609-4bc1-4c4b-9fcf-dd34aa538e59", "old_session": "4a5827a1-30b5-4baa-8541-223de8a3f8c8"}	\N	node	2026-06-21 23:07:31.684873+00
\.


--
-- Data for Name: event_outbox; Type: TABLE DATA; Schema: events; Owner: app
--

COPY events.event_outbox (id, aggregate_type, aggregate_id, event_type, routing_key, payload, headers, status, retry_count, available_at, published_at, error_message, created_at) FROM stdin;
87b184a9-0d0e-426d-90f3-de48ffa87cbe	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user.created	identity.user.created	{"data": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-18T12:37:40.064727+00:00", "updated_by": null, "last_login_at": "2026-06-18T12:37:40.064727+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 12:37:40.064727+00	\N	\N	2026-06-18 12:37:40.064727+00
01cf01b6-4277-42f4-af27-570c8995b752	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user_profile.created	identity.user.created	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-18T12:37:40.280261+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 12:37:40.280261+00	\N	\N	2026-06-18 12:37:40.280261+00
708d66f7-80b7-4e0a-b40b-d011403a45d4	identity.user	1747f31a-2972-4506-b997-1c03eb38aa6e	identity.user.created	identity.user.created	{"data": {"id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "email": "muhzannzs@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:44:15.592824+00:00", "deleted_at": null, "updated_at": "2026-06-18T12:44:15.592824+00:00", "updated_by": null, "last_login_at": "2026-06-18T12:44:15.592824+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:44:15.592824+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 12:44:15.592824+00	\N	\N	2026-06-18 12:44:15.592824+00
30042fd4-0e98-443b-9b6b-5b15fc74a9c7	identity.user	1747f31a-2972-4506-b997-1c03eb38aa6e	identity.user_profile.created	identity.user.created	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "location": null, "metadata": {"google": {"name": "Fauzan", "email": "muhzannzs@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "email_verified": true, "provider_user_id": "104705709147742782273"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "auth_provider": "google"}, "username": "fauzan", "birthdate": null, "full_name": "Fauzan", "created_at": "2026-06-18T12:44:15.638151+00:00", "search_tsv": "'fauzan':1", "updated_at": "2026-06-18T12:44:15.638151+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 12:44:15.638151+00	\N	\N	2026-06-18 12:44:15.638151+00
f41ff132-6750-457e-b895-af71b18081e6	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user.updated	identity.user.updated	{"data": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-18T15:24:37.237155+00:00", "updated_by": null, "last_login_at": "2026-06-18T15:24:37.237155+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 15:24:37.237155+00	\N	\N	2026-06-18 15:24:37.237155+00
e4cacd98-b5de-44f4-b3cd-054f6a314f77	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user_profile.updated	identity.user.updated	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-18T15:24:37.304093+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 15:24:37.304093+00	\N	\N	2026-06-18 15:24:37.304093+00
30fd7821-f0d9-4ce8-8de6-349155fc8d70	identity.user	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	identity.user.created	identity.user.created	{"data": {"id": "c3620d3b-4fc3-4eb7-babd-ecfdafb212c9", "email": "nuralysah90@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T16:21:28.37931+00:00", "deleted_at": null, "updated_at": "2026-06-18T16:21:28.37931+00:00", "updated_by": null, "last_login_at": "2026-06-18T16:21:28.37931+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T16:21:28.37931+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "c3620d3b-4fc3-4eb7-babd-ecfdafb212c9", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 16:21:28.37931+00	\N	\N	2026-06-18 16:21:28.37931+00
26cc968d-a0b4-4463-8c86-90980f423683	identity.user	c3620d3b-4fc3-4eb7-babd-ecfdafb212c9	identity.user_profile.created	identity.user.created	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "user_id": "c3620d3b-4fc3-4eb7-babd-ecfdafb212c9", "location": null, "metadata": {"google": {"name": "Nur Alysah", "email": "nuralysah90@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "email_verified": true, "provider_user_id": "109193261788063740196"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIVf46o9HK5VZHdSexBZvRtzkGjbGgKVTuUCXemEbid8nw6plw=s96-c", "auth_provider": "google"}, "username": "nuralysah", "birthdate": null, "full_name": "Nur Alysah", "created_at": "2026-06-18T16:21:28.485988+00:00", "search_tsv": "'alysah':2 'nur':1", "updated_at": "2026-06-18T16:21:28.485988+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "c3620d3b-4fc3-4eb7-babd-ecfdafb212c9", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-18 16:21:28.485988+00	\N	\N	2026-06-18 16:21:28.485988+00
e8de4a81-06a8-403a-b141-6dcd6ded3a4b	identity.user	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	identity.user.created	identity.user.created	{"data": {"id": "c8a11d02-d8bf-40b8-b54e-92909c3df8fd", "email": "prestasiproperty7@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-19T00:01:59.244521+00:00", "deleted_at": null, "updated_at": "2026-06-19T00:01:59.244521+00:00", "updated_by": null, "last_login_at": "2026-06-19T00:01:59.244521+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-19T00:01:59.244521+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "c8a11d02-d8bf-40b8-b54e-92909c3df8fd", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 00:01:59.244521+00	\N	\N	2026-06-19 00:01:59.244521+00
5def41d9-e582-457d-8548-a01b8d5ae220	identity.user	c8a11d02-d8bf-40b8-b54e-92909c3df8fd	identity.user_profile.created	identity.user.created	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "user_id": "c8a11d02-d8bf-40b8-b54e-92909c3df8fd", "location": null, "metadata": {"google": {"name": "PRESTASI PROPERTY", "email": "prestasiproperty7@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "email_verified": true, "provider_user_id": "109091404271703494939"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ22Ujt4fwlaNs5UVy5mPLtdKSzrXUE1gtWOv3QVvPTYuDcZMc=s96-c", "auth_provider": "google"}, "username": "prestasiproperty", "birthdate": null, "full_name": "PRESTASI PROPERTY", "created_at": "2026-06-19T00:01:59.426932+00:00", "search_tsv": "'prestasi':1 'property':2", "updated_at": "2026-06-19T00:01:59.426932+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "c8a11d02-d8bf-40b8-b54e-92909c3df8fd", "operation": "INSERT", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 00:01:59.426932+00	\N	\N	2026-06-19 00:01:59.426932+00
bc4130b6-3088-49dc-a2bc-8fd6ea7a4d49	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user.updated	identity.user.updated	{"data": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-19T07:19:43.409581+00:00", "updated_by": null, "last_login_at": "2026-06-19T07:19:43.409581+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 07:19:43.409581+00	\N	\N	2026-06-19 07:19:43.409581+00
9a0afc27-414e-425c-8488-fbb559adc2ce	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user_profile.updated	identity.user.updated	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-19T07:19:43.590808+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 07:19:43.590808+00	\N	\N	2026-06-19 07:19:43.590808+00
9c123996-d34d-4da5-999a-619d69404cd8	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user.updated	identity.user.updated	{"data": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-19T11:18:13.81807+00:00", "updated_by": null, "last_login_at": "2026-06-19T11:18:13.81807+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 11:18:13.81807+00	\N	\N	2026-06-19 11:18:13.81807+00
1fa0b982-9aa0-497e-b445-9c77180a6ac7	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user_profile.updated	identity.user.updated	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-19T11:18:13.938928+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 11:18:13.938928+00	\N	\N	2026-06-19 11:18:13.938928+00
dd5d03e2-7dbf-499f-ac50-91f449577516	identity.user	1747f31a-2972-4506-b997-1c03eb38aa6e	identity.user.updated	identity.user.updated	{"data": {"id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "email": "muhzannzs@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:44:15.592824+00:00", "deleted_at": null, "updated_at": "2026-06-19T14:04:27.174923+00:00", "updated_by": null, "last_login_at": "2026-06-19T14:04:27.174923+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:44:15.592824+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 14:04:27.174923+00	\N	\N	2026-06-19 14:04:27.174923+00
4f1ac6f8-9d0c-48d9-8fb0-dbc651c86df6	identity.user	1747f31a-2972-4506-b997-1c03eb38aa6e	identity.user_profile.updated	identity.user.updated	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "location": null, "metadata": {"google": {"name": "Fauzan", "email": "muhzannzs@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "email_verified": true, "provider_user_id": "104705709147742782273"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c", "auth_provider": "google"}, "username": "fauzan", "birthdate": null, "full_name": "Fauzan", "created_at": "2026-06-18T12:44:15.638151+00:00", "search_tsv": "'fauzan':1", "updated_at": "2026-06-19T14:04:27.480035+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "1747f31a-2972-4506-b997-1c03eb38aa6e", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-19 14:04:27.480035+00	\N	\N	2026-06-19 14:04:27.480035+00
31eedfcb-c8d2-49f2-bd7b-e805f812afa6	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user.updated	identity.user.updated	{"data": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-20T05:39:05.630807+00:00", "updated_by": null, "last_login_at": "2026-06-20T05:39:05.630807+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-20 05:39:05.630807+00	\N	\N	2026-06-20 05:39:05.630807+00
c757ddfa-d76e-4282-8f3a-5081865d8761	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user_profile.updated	identity.user.updated	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-20T05:39:05.699434+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-20 05:39:05.699434+00	\N	\N	2026-06-20 05:39:05.699434+00
c6b7f2a6-1ef9-4763-92da-b26f21617d0a	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user.updated	identity.user.updated	{"data": {"id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "email": "fauzanyanuarp@gmail.com", "phone": null, "status": "active", "actor_id": null, "is_active": true, "created_at": "2026-06-18T12:37:40.064727+00:00", "deleted_at": null, "updated_at": "2026-06-21T22:29:36.090017+00:00", "updated_by": null, "last_login_at": "2026-06-21T22:29:36.090017+00:00", "password_hash": null, "email_verified": true, "phone_verified": false, "public_key_jwks": null, "lockout_expires_at": null, "password_changed_at": "2026-06-18T12:37:40.064727+00:00", "failed_login_attempts": 0}, "table": "core.users", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-21 22:29:36.090017+00	\N	\N	2026-06-21 22:29:36.090017+00
9a978a00-141c-4218-8e0c-815e175393ca	identity.user	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	identity.user_profile.updated	identity.user.updated	{"data": {"bio": null, "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "location": null, "metadata": {"google": {"name": "Fauzan Yanuarp", "email": "fauzanyanuarp@gmail.com", "picture": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "email_verified": true, "provider_user_id": "105685214361219477879"}, "avatar_url": "https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c", "auth_provider": "google"}, "username": "fauzanyanuarp", "birthdate": null, "full_name": "Fauzan Yanuarp", "created_at": "2026-06-18T12:37:40.280261+00:00", "search_tsv": "'fauzan':1 'yanuarp':2", "updated_at": "2026-06-21T22:29:36.17092+00:00"}, "table": "core.user_profiles", "source": "identity_service", "user_id": "3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5", "operation": "UPDATE", "schema_version": 1}	{"content_type": "application/json"}	pending	0	2026-06-21 22:29:36.17092+00	\N	\N	2026-06-21 22:29:36.17092+00
\.


--
-- Data for Name: _sqlx_migrations; Type: TABLE DATA; Schema: public; Owner: app
--

COPY public._sqlx_migrations (version, description, installed_on, success, checksum, execution_time) FROM stdin;
1	init	2026-06-18 12:30:58.563709+00	t	\\xad62e6f4c961c51f36114a164fe525b430c6391a01cb1f7948f5c998cbd4c59e77424ca3dbe7f0b389efd392ba380fec	902921410
20251115122000	functions security	2026-06-18 12:30:59.473181+00	t	\\xc33dc543e6daa9c080e7f1fcb11e780bec24b82317fab3b2c8250783f98015d3cbe6f550e3e8df6a5c0bc77a0201172a	23854869
20251115123000	functions timestamp	2026-06-18 12:30:59.612049+00	t	\\x249fc9d9ddfb6853f067ea0512a9d0f02e53fb2757bda619b116971d9db2f393a89bba68e7d36159b6ef7fbd4721554a	70724147
20251115124000	tables core	2026-06-18 12:30:59.689659+00	t	\\x950799fd7e8e563393d2d8c55c437e7be419b1336b61cc1689de750fcafd7c91bd07cef147ee6cb52dfb0b6c6e6192d2	555392719
20251115125000	tables users	2026-06-18 12:31:00.327502+00	t	\\x0da3aec29fd1399d87b65aae3229494d38ebd12e880a3980ee320098f7289c6e41a1d803d776f14997d03be634a31d14	3342683540
20251115126000	tables roles permissions	2026-06-18 12:31:03.75068+00	t	\\xdd525d6ff8b7ae9d9b997611359296e9120c239d1003f190efb05f07c2dac0fa2fc8ee7caf43194be6b89f218062b23d	3436317220
20251115126040	tables sessions	2026-06-18 12:31:07.235357+00	t	\\x62bdf42a2dbe3875f1064742e8272035afa10b0bac0ba9ae3f7ee6051430851b15e88d0998f80d10ba23943519ba54cb	687206980
20251115126050	functions audit	2026-06-18 12:31:07.942157+00	t	\\x7c145ca5d69ab6f9b26f2f65132b1c897b6cbf9d6552890ae0bc96a14e5180f76f517d86fa99583b979d8eb0d114ad80	144338335
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: events; Owner: app
--

SELECT pg_catalog.setval('events.audit_logs_id_seq', 297, true);


--
-- Name: _sqlx_migrations _sqlx_migrations_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);


--
-- Name: group_roles group_roles_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.group_roles
    ADD CONSTRAINT group_roles_pkey PRIMARY KEY (group_id, role_id);


--
-- Name: group_users group_users_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.group_users
    ADD CONSTRAINT group_users_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: groups groups_org_id_name_key; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.groups
    ADD CONSTRAINT groups_org_id_name_key UNIQUE (org_id, name);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: organization_users organization_users_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organization_users
    ADD CONSTRAINT organization_users_pkey PRIMARY KEY (org_id, user_id);


--
-- Name: organizations organizations_name_key; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organizations
    ADD CONSTRAINT organizations_name_key UNIQUE (name);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_slug_key; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);


--
-- Name: permissions permissions_name_key; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.permissions
    ADD CONSTRAINT permissions_name_key UNIQUE (name);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: user_identities user_identities_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_identities
    ADD CONSTRAINT user_identities_pkey PRIMARY KEY (id);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: user_profiles user_profiles_username_key; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_profiles
    ADD CONSTRAINT user_profiles_username_key UNIQUE (username);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: events; Owner: app
--

ALTER TABLE ONLY events.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: event_outbox event_outbox_pkey; Type: CONSTRAINT; Schema: events; Owner: app
--

ALTER TABLE ONLY events.event_outbox
    ADD CONSTRAINT event_outbox_pkey PRIMARY KEY (id);


--
-- Name: _sqlx_migrations _sqlx_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: app
--

ALTER TABLE ONLY public._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);


--
-- Name: idx_group_org; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_group_org ON core.groups USING btree (org_id);


--
-- Name: idx_group_roles_group; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_group_roles_group ON core.group_roles USING btree (group_id);


--
-- Name: idx_group_users_group; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_group_users_group ON core.group_users USING btree (group_id);


--
-- Name: idx_group_users_user; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_group_users_user ON core.group_users USING btree (user_id);


--
-- Name: idx_org_deleted; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_org_deleted ON core.organizations USING btree (deleted_at);


--
-- Name: idx_org_slug; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_org_slug ON core.organizations USING btree (slug);


--
-- Name: idx_org_users_org; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_org_users_org ON core.organization_users USING btree (org_id);


--
-- Name: idx_org_users_user; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_org_users_user ON core.organization_users USING btree (user_id);


--
-- Name: idx_permission_name; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_permission_name ON core.permissions USING btree (name);


--
-- Name: idx_profiles_tsv; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_profiles_tsv ON core.user_profiles USING gin (search_tsv);


--
-- Name: idx_profiles_username; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_profiles_username ON core.user_profiles USING btree (username);


--
-- Name: idx_role_permissions_permission; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_role_permissions_permission ON core.role_permissions USING btree (permission_id);


--
-- Name: idx_role_permissions_role; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_role_permissions_role ON core.role_permissions USING btree (role_id);


--
-- Name: idx_role_permissions_role_permission; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_role_permissions_role_permission ON core.role_permissions USING btree (role_id, permission_id);


--
-- Name: idx_roles_name; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_roles_name ON core.roles USING btree (name);


--
-- Name: idx_roles_type; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_roles_type ON core.roles USING btree (role_type);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_sessions_expires_at ON core.sessions USING btree (expires_at);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_sessions_user_id ON core.sessions USING btree (user_id);


--
-- Name: idx_user_identities_provider_subject; Type: INDEX; Schema: core; Owner: app
--

CREATE UNIQUE INDEX idx_user_identities_provider_subject ON core.user_identities USING btree (provider, provider_user_id);


--
-- Name: idx_user_identities_provider_user; Type: INDEX; Schema: core; Owner: app
--

CREATE UNIQUE INDEX idx_user_identities_provider_user ON core.user_identities USING btree (provider, user_id);


--
-- Name: idx_user_identities_user_id; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_identities_user_id ON core.user_identities USING btree (user_id);


--
-- Name: idx_user_profiles_freelancer_role; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_freelancer_role ON core.user_profiles USING btree (((metadata -> 'roles'::text))) WHERE (metadata ? 'roles'::text);


--
-- Name: idx_user_profiles_freelancer_search; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_freelancer_search ON core.user_profiles USING gin (to_tsvector('simple'::regconfig, ((((((COALESCE(full_name, ''::text) || ' '::text) || COALESCE(bio, ''::text)) || ' '::text) || COALESCE(((metadata -> 'freelancer_profile'::text) ->> 'tagline'::text), ''::text)) || ' '::text) || COALESCE(((metadata -> 'freelancer_profile'::text) ->> 'professional_title'::text), ''::text)))) WHERE ((metadata -> 'freelancer_profile'::text) IS NOT NULL);


--
-- Name: idx_user_profiles_full_name_trgm; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_full_name_trgm ON core.user_profiles USING gin (full_name public.gin_trgm_ops);


--
-- Name: idx_user_profiles_location_trgm; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_location_trgm ON core.user_profiles USING gin (location public.gin_trgm_ops);


--
-- Name: idx_user_profiles_metadata_gin; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_metadata_gin ON core.user_profiles USING gin (metadata);


--
-- Name: idx_user_profiles_provider_skills_gin; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_provider_skills_gin ON core.user_profiles USING gin ((((metadata -> 'provider_profile'::text) -> 'skills'::text))) WHERE ((metadata -> 'provider_profile'::text) IS NOT NULL);


--
-- Name: idx_user_profiles_roles_gin; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_roles_gin ON core.user_profiles USING gin (((metadata -> 'roles'::text))) WHERE (metadata ? 'roles'::text);


--
-- Name: idx_user_profiles_search_surface_tsv; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_search_surface_tsv ON core.user_profiles USING gin (to_tsvector('simple'::regconfig, ((((((((((((((COALESCE(full_name, ''::text) || ' '::text) || COALESCE((username)::text, ''::text)) || ' '::text) || COALESCE(location, ''::text)) || ' '::text) || COALESCE(bio, ''::text)) || ' '::text) || COALESCE(((metadata -> 'freelancer_profile'::text) ->> 'professional_title'::text), ''::text)) || ' '::text) || COALESCE(((metadata -> 'freelancer_profile'::text) ->> 'tagline'::text), ''::text)) || ' '::text) || COALESCE(((metadata -> 'provider_profile'::text) ->> 'headline'::text), ''::text)) || ' '::text) || COALESCE(((metadata -> 'buyer_profile'::text) ->> 'intent'::text), ''::text))));


--
-- Name: idx_user_profiles_skills; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_profiles_skills ON core.user_profiles USING gin ((((metadata -> 'freelancer_profile'::text) -> 'skills'::text))) WHERE ((metadata -> 'freelancer_profile'::text) IS NOT NULL);


--
-- Name: idx_user_roles_role; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_roles_role ON core.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_user_roles_user ON core.user_roles USING btree (user_id);


--
-- Name: idx_users_active_only; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_users_active_only ON core.users USING btree (id) WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: idx_users_deleted; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_users_deleted ON core.users USING btree (deleted_at);


--
-- Name: idx_users_locked; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_users_locked ON core.users USING btree (lockout_expires_at) WHERE (lockout_expires_at IS NOT NULL);


--
-- Name: idx_users_lower_email; Type: INDEX; Schema: core; Owner: app
--

CREATE UNIQUE INDEX idx_users_lower_email ON core.users USING btree (lower((email)::text));


--
-- Name: idx_users_phone_normalized_unique; Type: INDEX; Schema: core; Owner: app
--

CREATE UNIQUE INDEX idx_users_phone_normalized_unique ON core.users USING btree (regexp_replace(phone, '[^0-9]'::text, ''::text, 'g'::text)) WHERE ((deleted_at IS NULL) AND (phone IS NOT NULL));


--
-- Name: idx_users_status; Type: INDEX; Schema: core; Owner: app
--

CREATE INDEX idx_users_status ON core.users USING btree (status);


--
-- Name: idx_audit_actor; Type: INDEX; Schema: events; Owner: app
--

CREATE INDEX idx_audit_actor ON events.audit_logs USING btree (actor_id);


--
-- Name: idx_audit_entity; Type: INDEX; Schema: events; Owner: app
--

CREATE INDEX idx_audit_entity ON events.audit_logs USING btree (entity);


--
-- Name: idx_audit_user; Type: INDEX; Schema: events; Owner: app
--

CREATE INDEX idx_audit_user ON events.audit_logs USING btree (user_id);


--
-- Name: idx_identity_event_outbox_aggregate; Type: INDEX; Schema: events; Owner: app
--

CREATE INDEX idx_identity_event_outbox_aggregate ON events.event_outbox USING btree (aggregate_type, aggregate_id, created_at DESC);


--
-- Name: idx_identity_event_outbox_pending; Type: INDEX; Schema: events; Owner: app
--

CREATE INDEX idx_identity_event_outbox_pending ON events.event_outbox USING btree (status, available_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: organization_users audit_organization_users_changes; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER audit_organization_users_changes AFTER INSERT OR DELETE OR UPDATE ON core.organization_users FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();


--
-- Name: organizations audit_organizations_changes; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER audit_organizations_changes AFTER INSERT OR DELETE OR UPDATE ON core.organizations FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();


--
-- Name: permissions audit_permissions_changes; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER audit_permissions_changes AFTER INSERT OR DELETE OR UPDATE ON core.permissions FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();


--
-- Name: roles audit_roles_changes; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER audit_roles_changes AFTER INSERT OR DELETE OR UPDATE ON core.roles FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();


--
-- Name: user_profiles audit_user_profiles_changes; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER audit_user_profiles_changes AFTER INSERT OR DELETE OR UPDATE ON core.user_profiles FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();


--
-- Name: users audit_users_changes; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER audit_users_changes AFTER INSERT OR DELETE OR UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.audit_row_changes();


--
-- Name: groups groups_update_timestamp; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER groups_update_timestamp BEFORE UPDATE ON core.groups FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: organizations organizations_normalize_slug; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER organizations_normalize_slug BEFORE INSERT OR UPDATE ON core.organizations FOR EACH ROW EXECUTE FUNCTION public.normalize_org_slug();


--
-- Name: organizations organizations_track_updated_by; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER organizations_track_updated_by BEFORE UPDATE ON core.organizations FOR EACH ROW EXECUTE FUNCTION public.track_updated_by();


--
-- Name: organizations organizations_update_timestamp; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER organizations_update_timestamp BEFORE UPDATE ON core.organizations FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: permissions permissions_update_timestamp; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER permissions_update_timestamp BEFORE UPDATE ON core.permissions FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: roles roles_update_timestamp; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER roles_update_timestamp BEFORE UPDATE ON core.roles FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: user_profiles trg_identity_user_profiles_outbox; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER trg_identity_user_profiles_outbox AFTER INSERT OR DELETE OR UPDATE ON core.user_profiles FOR EACH ROW EXECUTE FUNCTION public.enqueue_identity_user_event();


--
-- Name: users trg_identity_users_outbox; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER trg_identity_users_outbox AFTER INSERT OR DELETE OR UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.enqueue_identity_user_event();


--
-- Name: roles trg_no_delete_system_roles; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER trg_no_delete_system_roles BEFORE DELETE ON core.roles FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_system_roles();


--
-- Name: organization_users trg_org_user_no_last_admin; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER trg_org_user_no_last_admin BEFORE DELETE ON core.organization_users FOR EACH ROW EXECUTE FUNCTION public.prevent_remove_last_org_admin();


--
-- Name: user_identities user_identities_update_timestamp; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER user_identities_update_timestamp BEFORE UPDATE ON core.user_identities FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: user_profiles user_profiles_normalize_username; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER user_profiles_normalize_username BEFORE INSERT OR UPDATE ON core.user_profiles FOR EACH ROW EXECUTE FUNCTION public.normalize_username();


--
-- Name: user_profiles user_profiles_update_timestamp; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER user_profiles_update_timestamp BEFORE UPDATE ON core.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: users users_reset_login_attempts; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER users_reset_login_attempts BEFORE UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.reset_login_attempts_on_password_change();


--
-- Name: users users_track_updated_by; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER users_track_updated_by BEFORE UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.track_updated_by();


--
-- Name: users users_update_timestamp; Type: TRIGGER; Schema: core; Owner: app
--

CREATE TRIGGER users_update_timestamp BEFORE UPDATE ON core.users FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: sessions fk_sessions_user; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.sessions
    ADD CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;


--
-- Name: group_roles group_roles_group_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.group_roles
    ADD CONSTRAINT group_roles_group_id_fkey FOREIGN KEY (group_id) REFERENCES core.groups(id) ON DELETE CASCADE;


--
-- Name: group_roles group_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.group_roles
    ADD CONSTRAINT group_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE;


--
-- Name: group_users group_users_group_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.group_users
    ADD CONSTRAINT group_users_group_id_fkey FOREIGN KEY (group_id) REFERENCES core.groups(id) ON DELETE CASCADE;


--
-- Name: group_users group_users_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.group_users
    ADD CONSTRAINT group_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;


--
-- Name: groups groups_org_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.groups
    ADD CONSTRAINT groups_org_id_fkey FOREIGN KEY (org_id) REFERENCES core.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_users organization_users_org_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organization_users
    ADD CONSTRAINT organization_users_org_id_fkey FOREIGN KEY (org_id) REFERENCES core.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_users organization_users_role_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organization_users
    ADD CONSTRAINT organization_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE RESTRICT;


--
-- Name: organization_users organization_users_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organization_users
    ADD CONSTRAINT organization_users_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.organizations
    ADD CONSTRAINT organizations_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES core.users(id) ON DELETE SET NULL;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES core.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE;


--
-- Name: user_identities user_identities_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_identities
    ADD CONSTRAINT user_identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES core.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: core; Owner: app
--

ALTER TABLE ONLY core.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES core.users(id) ON DELETE CASCADE;


--
-- Name: organizations org_is_member; Type: POLICY; Schema: core; Owner: app
--

CREATE POLICY org_is_member ON core.organizations USING (((current_setting('app.is_system_request'::text, true) = 'true'::text) OR public.is_system_admin((current_setting('app.current_user_id'::text, true))::uuid) OR (EXISTS ( SELECT 1
   FROM core.organization_users ou
  WHERE ((ou.org_id = organizations.id) AND (ou.user_id = (current_setting('app.current_user_id'::text, true))::uuid))))));


--
-- Name: organization_users org_users_member; Type: POLICY; Schema: core; Owner: app
--

CREATE POLICY org_users_member ON core.organization_users USING (((current_setting('app.is_system_request'::text, true) = 'true'::text) OR public.is_system_admin((current_setting('app.current_user_id'::text, true))::uuid) OR (user_id = (current_setting('app.current_user_id'::text, true))::uuid)));


--
-- Name: organization_users; Type: ROW SECURITY; Schema: core; Owner: app
--

ALTER TABLE core.organization_users ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: core; Owner: app
--

ALTER TABLE core.organizations ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict szYeYbjnXPEuye0aJaJPVVohbgUC1LMO81bYfekFsKvCZHlAEHlBMBEUBWTn75X

