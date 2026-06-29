--
-- PostgreSQL database dump
--

\restrict X7DRhvzExAbDMkhG9f5GHGZT1hhpQyJqTpwlcA8DpgZZ4qVElNKaepmE2vC123d

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
-- Name: events; Type: SCHEMA; Schema: -; Owner: app
--

CREATE SCHEMA events;


ALTER SCHEMA events OWNER TO app;

--
-- Name: forum; Type: SCHEMA; Schema: -; Owner: app
--

CREATE SCHEMA forum;


ALTER SCHEMA forum OWNER TO app;

--
-- Name: reel; Type: SCHEMA; Schema: -; Owner: app
--

CREATE SCHEMA reel;


ALTER SCHEMA reel OWNER TO app;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA forum;


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
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA forum;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: event_inbox; Type: TABLE; Schema: events; Owner: app
--

CREATE TABLE events.event_inbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    aggregate_type text NOT NULL,
    aggregate_id text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    retry_count integer DEFAULT 0 NOT NULL,
    available_at timestamp with time zone DEFAULT now() NOT NULL,
    processed_at timestamp with time zone,
    error_message text,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT event_inbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'processed'::text, 'failed'::text])))
);


ALTER TABLE events.event_inbox OWNER TO app;

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
-- Name: _sqlx_migrations; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);


ALTER TABLE forum._sqlx_migrations OWNER TO app;

--
-- Name: lajukan_forum_audit_logs; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_audit_logs (
    id text NOT NULL,
    action text NOT NULL,
    actor_user_id text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE forum.lajukan_forum_audit_logs OWNER TO app;

--
-- Name: lajukan_forum_categories; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_categories (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    icon text DEFAULT 'forum'::text NOT NULL,
    color text DEFAULT '#0ea5e9'::text NOT NULL,
    parent_id text,
    "position" integer DEFAULT 0 NOT NULL,
    thread_count integer DEFAULT 0 NOT NULL,
    post_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE forum.lajukan_forum_categories OWNER TO app;

--
-- Name: lajukan_forum_posts; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_posts (
    id text NOT NULL,
    thread_id text NOT NULL,
    author_id text NOT NULL,
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    like_count integer DEFAULT 0 NOT NULL,
    reply_to_post_id text,
    is_answer boolean DEFAULT false NOT NULL,
    reactions jsonb DEFAULT '{}'::jsonb NOT NULL,
    image_urls text[] DEFAULT '{}'::text[] NOT NULL
);


ALTER TABLE forum.lajukan_forum_posts OWNER TO app;

--
-- Name: lajukan_forum_tags; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_tags (
    id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    color text DEFAULT '#64748b'::text NOT NULL,
    usage_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE forum.lajukan_forum_tags OWNER TO app;

--
-- Name: lajukan_forum_thread_tags; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_thread_tags (
    thread_id text NOT NULL,
    tag_slug text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL
);


ALTER TABLE forum.lajukan_forum_thread_tags OWNER TO app;

--
-- Name: lajukan_forum_threads; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_threads (
    id text NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    category_id text NOT NULL,
    author_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_activity_at timestamp with time zone DEFAULT now() NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    reply_count integer DEFAULT 0 NOT NULL,
    like_count integer DEFAULT 0 NOT NULL,
    bookmark_count integer DEFAULT 0 NOT NULL,
    is_pinned boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    is_solved boolean DEFAULT false NOT NULL,
    solution_post_id text,
    status text DEFAULT 'open'::text NOT NULL,
    image_urls text[] DEFAULT '{}'::text[] NOT NULL,
    group_id text
);


ALTER TABLE forum.lajukan_forum_threads OWNER TO app;

--
-- Name: lajukan_forum_users; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_users (
    id text NOT NULL,
    username text NOT NULL,
    name text NOT NULL,
    avatar_url text DEFAULT '/default-avatar.svg'::text NOT NULL,
    title text DEFAULT 'Community Member'::text NOT NULL,
    reputation integer DEFAULT 0 NOT NULL,
    base_reputation integer DEFAULT 0 NOT NULL,
    badges text[] DEFAULT '{}'::text[] NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    identity_synced_at timestamp with time zone,
    deleted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE forum.lajukan_forum_users OWNER TO app;

--
-- Name: lajukan_forum_votes; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_forum_votes (
    id text NOT NULL,
    target_type text NOT NULL,
    target_id text NOT NULL,
    user_id text NOT NULL,
    value integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lajukan_forum_votes_value_check CHECK ((value = ANY (ARRAY['-1'::integer, 1])))
);


ALTER TABLE forum.lajukan_forum_votes OWNER TO app;

--
-- Name: lajukan_group_members; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_group_members (
    group_id text NOT NULL,
    user_id text NOT NULL,
    role text DEFAULT 'member'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    notifications_enabled boolean DEFAULT true NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lajukan_group_members_role_check CHECK ((role = ANY (ARRAY['owner'::text, 'moderator'::text, 'member'::text]))),
    CONSTRAINT lajukan_group_members_status_check CHECK ((status = ANY (ARRAY['active'::text, 'pending'::text, 'blocked'::text])))
);


ALTER TABLE forum.lajukan_group_members OWNER TO app;

--
-- Name: lajukan_groups; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_groups (
    id text NOT NULL,
    category_id text NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    privacy text DEFAULT 'public'::text NOT NULL,
    posting_permission text DEFAULT 'member'::text NOT NULL,
    membership_permission text DEFAULT 'open'::text NOT NULL,
    cover_url text,
    rules text[] DEFAULT '{}'::text[] NOT NULL,
    created_by_user_id text,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lajukan_groups_membership_permission_check CHECK ((membership_permission = ANY (ARRAY['open'::text, 'approval'::text, 'invite'::text]))),
    CONSTRAINT lajukan_groups_posting_permission_check CHECK ((posting_permission = ANY (ARRAY['public'::text, 'member'::text, 'moderator'::text]))),
    CONSTRAINT lajukan_groups_privacy_check CHECK ((privacy = ANY (ARRAY['public'::text, 'private'::text, 'hidden'::text]))),
    CONSTRAINT lajukan_groups_status_check CHECK ((status = ANY (ARRAY['active'::text, 'archived'::text, 'blocked'::text])))
);


ALTER TABLE forum.lajukan_groups OWNER TO app;

--
-- Name: lajukan_reel_events; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_reel_events (
    id text NOT NULL,
    reel_id text NOT NULL,
    actor_user_id text,
    anon_key_hash text,
    event_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lajukan_reel_events_event_type_check CHECK ((event_type = ANY (ARRAY['view'::text, 'watch'::text, 'like'::text, 'share'::text, 'comment'::text, 'open_store'::text, 'open_product'::text])))
);


ALTER TABLE forum.lajukan_reel_events OWNER TO app;

--
-- Name: lajukan_reel_user_actions; Type: TABLE; Schema: forum; Owner: app
--

CREATE TABLE forum.lajukan_reel_user_actions (
    id text NOT NULL,
    reel_id text NOT NULL,
    actor_user_id text NOT NULL,
    target_user_id text,
    action text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT lajukan_reel_user_actions_action_check CHECK ((action = ANY (ARRAY['like'::text, 'save'::text, 'follow'::text])))
);


ALTER TABLE forum.lajukan_reel_user_actions OWNER TO app;

--
-- Name: lajukan_reel_comments; Type: TABLE; Schema: reel; Owner: app
--

CREATE TABLE reel.lajukan_reel_comments (
    id text NOT NULL,
    reel_id text NOT NULL,
    author_user_id text NOT NULL,
    author_name text NOT NULL,
    author_avatar_url text,
    body text NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    parent_comment_id text,
    reply_count integer DEFAULT 0 NOT NULL,
    author_avatar text,
    CONSTRAINT lajukan_reel_comments_status_check CHECK ((status = ANY (ARRAY['published'::text, 'deleted'::text, 'blocked'::text])))
);


ALTER TABLE reel.lajukan_reel_comments OWNER TO app;

--
-- Name: lajukan_reels; Type: TABLE; Schema: reel; Owner: app
--

CREATE TABLE reel.lajukan_reels (
    id text NOT NULL,
    creator_user_id text,
    creator text NOT NULL,
    title text NOT NULL,
    caption text NOT NULL,
    tag text NOT NULL,
    product_name text,
    product_price text,
    product_href text,
    video_src text NOT NULL,
    source_url text NOT NULL,
    likes_count bigint DEFAULT 0 NOT NULL,
    comments_count bigint DEFAULT 0 NOT NULL,
    shares_count bigint DEFAULT 0 NOT NULL,
    tone text DEFAULT 'emerald'::text NOT NULL,
    icon_key text DEFAULT 'supplier'::text NOT NULL,
    media_url text NOT NULL,
    media_type text DEFAULT 'video'::text NOT NULL,
    hook text DEFAULT ''::text NOT NULL,
    store_id text DEFAULT ''::text NOT NULL,
    store_slug text DEFAULT ''::text NOT NULL,
    store_name text DEFAULT ''::text NOT NULL,
    store_city text DEFAULT ''::text NOT NULL,
    store_phone text,
    storefront_path text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'published'::text NOT NULL,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    filter_preset text DEFAULT 'natural'::text NOT NULL,
    capture_mode text DEFAULT 'upload'::text NOT NULL,
    live_status text DEFAULT 'none'::text NOT NULL,
    live_title text,
    live_scheduled_at timestamp with time zone,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT lajukan_reels_capture_mode_check CHECK ((capture_mode = ANY (ARRAY['upload'::text, 'camera'::text, 'live'::text]))),
    CONSTRAINT lajukan_reels_filter_preset_check CHECK ((filter_preset = ANY (ARRAY['natural'::text, 'warm'::text, 'fresh'::text, 'cinema'::text, 'mono'::text, 'pop'::text]))),
    CONSTRAINT lajukan_reels_live_status_check CHECK ((live_status = ANY (ARRAY['none'::text, 'scheduled'::text, 'live'::text, 'ended'::text]))),
    CONSTRAINT lajukan_reels_media_type_check CHECK ((media_type = ANY (ARRAY['video'::text, 'image'::text]))),
    CONSTRAINT lajukan_reels_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'published'::text, 'archived'::text, 'blocked'::text])))
);


ALTER TABLE reel.lajukan_reels OWNER TO app;

--
-- Data for Name: event_inbox; Type: TABLE DATA; Schema: events; Owner: app
--

COPY events.event_inbox (id, source, event_id, event_type, aggregate_type, aggregate_id, payload, status, retry_count, available_at, processed_at, error_message, received_at) FROM stdin;
\.


--
-- Data for Name: event_outbox; Type: TABLE DATA; Schema: events; Owner: app
--

COPY events.event_outbox (id, aggregate_type, aggregate_id, event_type, routing_key, payload, status, retry_count, available_at, published_at, error_message, created_at) FROM stdin;
\.


--
-- Data for Name: _sqlx_migrations; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum._sqlx_migrations (version, description, installed_on, success, checksum, execution_time) FROM stdin;
1	init	2026-06-18 12:36:12.824456+00	t	\\xaa062b9b9198c0d1c42d5c5cdef9da6b8f1402b5b1e333ed28e1d623c02bf05d123bcef898aaa346d19f881435cf844e	221503194
20260519000000	community forum	2026-06-18 12:36:13.06433+00	t	\\x6987ef16a44d39d8104324cffdbf5b50ab0a5eb31ddfcc834bad746a32355a04227fce30527cf8ed8ccc0731417cf7da	1143586506
20260519001000	reels	2026-06-18 12:36:14.211498+00	t	\\x749c6c30e0a0d9b740f76c21b8b4fba7a5f495f6bb2af935b8f49c23b8d13e9558bc3e23f10aa29f5ddc2bcd5b12bb3f	172831066
20260519002000	groups media	2026-06-18 12:36:14.388637+00	t	\\xa0c650a2c3f4c5f9970c3599f329bc2f869c3998b822dc28f703cd389b4cf4b99b54196d7ab625b28688bb0bfef7db88	150048348
20260519003000	reel comments	2026-06-18 12:36:14.570452+00	t	\\x9d8a548965efda6eae64366540ffadcb4baf50f1653381775de431fc37ea851349ae98d421ee1c9ddaed27766a57b83d	84713455
20260520002000	reel comment replies	2026-06-18 12:36:14.658661+00	t	\\x13498835a5f338d50162f3bd3c80c5f757f893c28cd67f1f17e166b6dd940378bfa46782f0ecbf7e2433576e6e349768	48698518
20260520004000	group moderator seed	2026-06-18 12:36:14.725287+00	t	\\xfdabcf0784552724f60c5c1acb788700f44d13130b0b69f0045b6edaaaefaa38e3affe86a3aed57cbd432f776e2dbe74	28045978
20260527001000	seed more reels	2026-06-18 12:36:14.757312+00	t	\\x3779a3b3c968534aaa54fbb1b3837b958d6287534d4086620eb18c5a3a1ebfa20aa48eb39a773e5de6cba93fdf736e07	24465209
20260527002000	reel user actions	2026-06-18 12:36:14.821996+00	t	\\xfd5ff4efd736cc1e3f2134855cf7446a1dad28bfd087bb1d28e7b6cb3baed6574152cbdf149f9c11e097257352b87279	302991905
20260530094000	reels studio live metadata	2026-06-18 12:36:15.133675+00	t	\\x3d3ce7a203fd6207c3439e1f65be14a850710f7e88a52a1eadc9a5ff7c14607a7a12e38c09f9bf8a2216bcb750cf4618	78752682
20260530130500	forum thread group scope	2026-06-18 12:36:15.224833+00	t	\\x2006ee9bfc957ab069072b68f241801354e23dd280eb1c16121ffeca0b3ee3c51876a5042c345ff07b3864222ec8c014	100593152
20260616091000	event bus read models	2026-06-18 12:36:15.338486+00	t	\\xfca252fd576fadac38ebeeb8c07fc34ebe9270029a13b9767180ac1be04867c1dd39673f78ccc338d701e7a1dfaf7826	502216705
20260619000000	reel comment author avatar compat	2026-06-19 11:49:46.411219+00	t	\\x7e460da46e928c8d4820f557512d926022f4e90fe4e6f3d17f5cf765d08cd238b9d7644754e1c72e9a5ebaf5bf9f82dc	144975892
\.


--
-- Data for Name: lajukan_forum_audit_logs; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_audit_logs (id, action, actor_user_id, target_type, target_id, metadata, created_at) FROM stdin;
a-1781802124351-d09b8439	thread.create	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	thread	th-1781802124321-38c75de8	{"groupId": null, "hasMedia": true, "tagCount": 0, "categoryId": "c-fyp"}	2026-06-18 17:02:04.322467+00
a-1781808608841-77f4e11f	group.create	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	group	g-1781808608790-3292548e	{"slug": "umkm-indonesia", "privacy": "public", "postingPermission": "member"}	2026-06-18 18:50:08.793686+00
a-1781813353504-b2a6663a	reel.create	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	reel	reel-1781813353455-21328074	{"mediaType": "video", "storeSlug": "fauzan-yanuarp", "liveStatus": "none", "captureMode": "upload", "filterPreset": "natural"}	2026-06-18 20:09:13.457835+00
a-1781813401469-8e0c3723	reel.action.set	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	reel	reel-1781813353455-21328074	{"action": "like", "changed": true}	2026-06-18 20:10:01.460222+00
a-1781827342063-df12a041	reel.action.set	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	reel	reel-1781813353455-21328074	{"action": "like", "changed": true}	2026-06-19 00:02:22.051966+00
a-1781827476073-2a1fc0cb	post.create	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	post	p-1781827475978-a34f7b5f	{"threadId": "th-1781802124321-38c75de8", "hasImages": false}	2026-06-19 00:04:35.979528+00
a-1781870491039-69c94cd5	reel.create	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	reel	reel-1781870490939-bd73f2f5	{"mediaType": "video", "storeSlug": "fauzan-yanuarp", "liveStatus": "none", "captureMode": "upload", "filterPreset": "natural"}	2026-06-19 12:01:30.952022+00
a-1781870660707-a878a0e4	post.create	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	post	p-1781870660625-35908251	{"threadId": "th-1781802124321-38c75de8", "hasImages": false}	2026-06-19 12:04:20.626385+00
a-1781872248440-14e63198	reel.comment.create	auth-11111111-1111-1111-1111-111111111111	reel_comment	rc-1781872248281-2a473b64	{"reelId": "reel-1781813353455-21328074", "bodyLength": 7, "parentCommentId": null}	2026-06-19 12:30:48.284039+00
a-1781879420157-c458844d	reel.comment.create	auth-user-123	reel_comment	rc-1781879420129-81ecb2d3	{"reelId": "reel-1781813353455-21328074", "bodyLength": 14, "parentCommentId": null}	2026-06-19 14:30:20.130904+00
\.


--
-- Data for Name: lajukan_forum_categories; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_categories (id, name, slug, description, icon, color, parent_id, "position", thread_count, post_count, created_at, updated_at) FROM stdin;
c-1781808608790-dddb3c47	UMKM Indonesia	umkm-indonesia	UMKM Indonesia adalah ruang untuk pelaku usaha kecil dan menengah di seluruh Indonesia untuk saling terhubung, berbagi informasi, mencari supplier, produk, jasa, dan peluang bisnis.\nGroup ini bertujuan membantu UMKM berkembang lebih cepat melalui kolaborasi dan akses pasar yang l	community	#10b981	\N	1	0	0	2026-06-18 18:50:08.793686+00	2026-06-18 18:50:08.793686+00
c-fyp	Publik	fyp	Posting publik lintas komunitas dan update umum.	community	#10b981	\N	0	1	3	2026-06-18 12:36:15.224833+00	2026-06-18 12:36:15.224833+00
\.


--
-- Data for Name: lajukan_forum_posts; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_posts (id, thread_id, author_id, content, created_at, updated_at, like_count, reply_to_post_id, is_answer, reactions, image_urls) FROM stdin;
p-1781802124321-7ca9c53a	th-1781802124321-38c75de8	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	Hubungi 082117148623	2026-06-18 17:02:04.322467+00	\N	0	\N	f	{}	{/api/forum/media/forum-1781802087252-f23fa48e-1000034101.png}
p-1781827475978-a34f7b5f	th-1781802124321-38c75de8	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	kerenn	2026-06-19 00:04:35.979528+00	\N	0	\N	f	{}	{}
p-1781870660625-35908251	th-1781802124321-38c75de8	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	test	2026-06-19 12:04:20.626385+00	\N	0	p-1781827475978-a34f7b5f	f	{}	{}
\.


--
-- Data for Name: lajukan_forum_tags; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_tags (id, name, slug, description, color, usage_count) FROM stdin;
\.


--
-- Data for Name: lajukan_forum_thread_tags; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_thread_tags (thread_id, tag_slug, "position") FROM stdin;
\.


--
-- Data for Name: lajukan_forum_threads; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_threads (id, title, slug, category_id, author_id, created_at, last_activity_at, views, reply_count, like_count, bookmark_count, is_pinned, is_locked, is_solved, solution_post_id, status, image_urls, group_id) FROM stdin;
th-1781802124321-38c75de8	Jasa Membuat Website	jasa-membuat-website	c-fyp	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	2026-06-18 17:02:04.322467+00	2026-06-19 12:04:20.626385+00	6	2	0	0	f	f	f	\N	open	{/api/forum/media/forum-1781802087252-f23fa48e-1000034101.png}	\N
\.


--
-- Data for Name: lajukan_forum_users; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_users (id, username, name, avatar_url, title, reputation, base_reputation, badges, metadata, identity_synced_at, deleted_at, created_at, updated_at) FROM stdin;
auth-11111111-1111-1111-1111-111111111111	codex_11111111-1	Codex	/default-avatar.svg	Community Member	0	0	{}	{}	\N	\N	2026-06-19 12:30:48.229181+00	2026-06-19 12:30:48.229181+00
auth-user-123	user_example.com_user-123	user@example.com	/default-avatar.svg	Community Member	0	0	{}	{}	\N	\N	2026-06-19 13:37:14.490781+00	2026-06-19 14:30:20.111356+00
auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	fauzanyanuarp	Fauzan Yanuarp	https://lh3.googleusercontent.com/a/ACg8ocIN-O1pTnH-mJmjA3CB42UTYpcyFU9XhgFggpLizMMG_FkTJyo=s96-c	Community Member	0	0	{}	{}	2026-06-20 06:38:52.908002+00	\N	2026-06-18 18:50:08.744085+00	2026-06-20 06:38:52.908002+00
auth-1747f31a-2972-4506-b997-1c03eb38aa6e	fauzan	Fauzan	https://lh3.googleusercontent.com/a/ACg8ocJ1EqegY_jzWAOx7WjgOH4vwFI7gRtOYoaVuORPv6uvn5Nr8_pz=s96-c	Community Member	0	0	{}	{}	2026-06-20 06:38:53.062688+00	\N	2026-06-18 17:02:04.301412+00	2026-06-20 06:38:53.062688+00
\.


--
-- Data for Name: lajukan_forum_votes; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_forum_votes (id, target_type, target_id, user_id, value, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lajukan_group_members; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_group_members (group_id, user_id, role, status, notifications_enabled, joined_at, updated_at) FROM stdin;
g-1781808608790-3292548e	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	owner	active	t	2026-06-18 18:50:08.793686+00	2026-06-18 18:50:08.793686+00
\.


--
-- Data for Name: lajukan_groups; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_groups (id, category_id, name, slug, description, privacy, posting_permission, membership_permission, cover_url, rules, created_by_user_id, status, created_at, updated_at) FROM stdin;
g-1781808608790-3292548e	c-1781808608790-dddb3c47	UMKM Indonesia	umkm-indonesia	UMKM Indonesia adalah ruang untuk pelaku usaha kecil dan menengah di seluruh Indonesia untuk saling terhubung, berbagi informasi, mencari supplier, produk, jasa, dan peluang bisnis.\nGroup ini bertujuan membantu UMKM berkembang lebih cepat melalui kolaborasi dan akses pasar yang l	public	member	open	\N	{"Diskusi harus relevan dengan usaha.","No spam.","No transaksi berisiko.","No scam."}	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	active	2026-06-18 18:50:08.793686+00	2026-06-18 18:50:08.793686+00
\.


--
-- Data for Name: lajukan_reel_events; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_reel_events (id, reel_id, actor_user_id, anon_key_hash, event_type, metadata, created_at) FROM stdin;
re-1781813387204-6213f387	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:09:47.204419+00
re-1781813389525-04dc32a7	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:09:49.525668+00
re-1781813391828-d30ac63e	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:09:51.828289+00
re-1781813394133-32a9d45b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:09:54.133513+00
re-1781813396434-f85e2414	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:09:56.434525+00
re-1781813398735-9c0346f6	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:09:58.735295+00
re-1781813401048-a689b712	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:01.047865+00
re-1781813403803-7164208f	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:03.803602+00
re-1781813406131-a5e8a0b8	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:06.131473+00
re-1781813408442-a95b84b3	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:08.442282+00
re-1781813410775-c0278d7d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:10.774141+00
re-1781813413102-736b234d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:13.102365+00
re-1781813415492-b881567d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:15.491896+00
re-1781813417844-2fb51079	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:17.844523+00
re-1781813420156-bf1e7ad4	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:20.156363+00
re-1781813422475-4e7725a5	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:22.474942+00
re-1781813424787-efaa4706	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:24.78709+00
re-1781813427154-b60f50b6	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:27.154563+00
re-1781813429480-5e0cb000	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:29.479988+00
re-1781813431757-e6b1a8d5	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:31.757153+00
re-1781813434050-2104215e	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:34.050264+00
re-1781813436353-3572a22d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:36.352957+00
re-1781813438663-3b92dad8	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:38.662923+00
re-1781813440977-f69ef468	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:40.977054+00
re-1781813443289-00b2f7f4	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:43.289012+00
re-1781813445622-d95be647	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:45.622083+00
re-1781813447919-18f550fd	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:47.919445+00
re-1781813450214-c2d6ca4d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:50.214395+00
re-1781813452554-115250fd	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:52.553923+00
re-1781813454889-c5da4ff9	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:54.888901+00
re-1781813457197-49474a26	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:57.197173+00
re-1781813459489-7845bdc2	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:10:59.489489+00
re-1781813461925-c30c862d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:01.924886+00
re-1781813464384-d2726458	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:04.383974+00
re-1781813466771-8331e137	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:06.770771+00
re-1781813469114-86d6e025	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:09.114133+00
re-1781813471434-76274c11	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:11.434022+00
re-1781813473817-b6781958	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:13.817541+00
re-1781813476206-4bf459ad	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:16.206572+00
re-1781813478542-42bd0e59	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:18.542535+00
re-1781813480866-3bed2d0b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:20.865745+00
re-1781813483282-b88e59d3	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:23.281802+00
re-1781813485684-b96712e7	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:25.683755+00
re-1781813488005-4924f4df	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:28.005052+00
re-1781813490323-4dd6d918	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:30.323414+00
re-1781813492644-c0247cfb	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:32.644015+00
re-1781813494969-69b03f65	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:11:34.969485+00
re-1781816049804-3afba402	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:09.803742+00
re-1781816052334-29f32aa3	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:12.328677+00
re-1781816054852-4b9fd4d8	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:14.852659+00
re-1781816062262-86b3f208	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:22.261694+00
re-1781816069293-3fc42d72	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:29.293234+00
re-1782082209660-7da102c2	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:09.660135+00
re-1782082216829-4a60f3a3	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:16.829496+00
re-1782082223879-b4af23ca	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:23.879132+00
re-1782082230919-eeaf59c8	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:30.91875+00
re-1782082238029-7df8cc40	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:38.029172+00
re-1782082245038-c28ebf4d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:45.037831+00
re-1782082252086-fe75ed43	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:52.086326+00
re-1782082259171-d8ed1f0c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:59.1715+00
re-1782082266158-b269a65c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:06.157729+00
re-1781816057414-6fa57f14	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:17.414209+00
re-1781816064617-e8714ee9	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:24.616825+00
re-1781816069543-47712712	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	share	{"signal": "share"}	2026-06-18 20:54:29.543359+00
re-1782082212071-8edb51d0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:12.071052+00
re-1782082219197-031b2a72	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:19.196913+00
re-1782082226206-314ae1d2	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:26.206085+00
re-1782082233323-959d2ec1	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:33.323054+00
re-1782082240364-53f5df95	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:40.36368+00
re-1782082247394-b5c4f703	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:47.394224+00
re-1782082254425-36f4d9fd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:54.425549+00
re-1782082261517-feafc8b0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:01.517659+00
re-1781816059851-a9f19f72	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:19.851393+00
re-1781816066945-75e3d0f9	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:54:26.944541+00
re-1781816213708-7551b163	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:56:53.707383+00
re-1781816216224-16bacccb	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:56:56.223891+00
re-1781816218661-2db35790	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:56:58.661093+00
re-1781816221176-d282dc74	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:01.176537+00
re-1781816223707-a8779c4a	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:03.706852+00
re-1781816226232-24cf3906	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:06.228872+00
re-1781816228587-d6ac5205	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:08.587579+00
re-1781816230950-9a722240	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:10.949804+00
re-1781816233342-a5e3f9aa	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:13.34173+00
re-1781816235727-1d802294	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:15.727143+00
re-1781816238099-9745e1bd	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:18.099199+00
re-1781816240611-cfbe0918	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:20.61094+00
re-1781816243005-381e621b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:23.004951+00
re-1781816245379-53268f8b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:25.378859+00
re-1781816247706-011890f0	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:27.706663+00
re-1781816250053-daed9fea	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:30.052548+00
re-1781816252579-f540418d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:32.57949+00
re-1781816255180-e935fabe	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 20:57:35.180634+00
re-1781816284640-80747d81	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:04.640343+00
re-1781816287018-b05f9daf	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:07.017771+00
re-1781816289329-05771fe2	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:09.329146+00
re-1781816291775-e731766e	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:11.77462+00
re-1781816294408-e086ef1c	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:14.40778+00
re-1781816296866-18141e9f	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:16.866417+00
re-1781816299414-93040c94	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:19.413736+00
re-1781816301878-ecc1c720	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:21.878213+00
re-1781816304262-28e1183c	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:24.262385+00
re-1781816306648-38584e6d	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:26.648798+00
re-1781816309018-28d874fd	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:29.018526+00
re-1781816311365-170f2747	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:31.365615+00
re-1781816313764-2d4de08d	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:33.764133+00
re-1781816316399-2d5fe652	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:36.399333+00
re-1781816318749-f28a3532	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:38.748617+00
re-1781816321088-b179e8f6	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:41.088364+00
re-1781816323437-f0d5a341	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:43.437586+00
re-1781816325780-c6293f1e	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:45.780793+00
re-1781816328094-a35216e6	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:48.094071+00
re-1781816330442-7cdd27e4	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:50.442712+00
re-1781816332780-90912f76	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:52.780521+00
re-1781816335242-bb58463d	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:55.242544+00
re-1781816337584-78cb48d7	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:57.583994+00
re-1781816339931-0d8a4757	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:58:59.931165+00
re-1781816342237-7dd37ff4	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:02.237337+00
re-1781816344603-cc45eaa2	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:04.603806+00
re-1781816346930-9d496d24	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:06.930502+00
re-1781816349234-ee3b238a	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:09.234012+00
re-1781816351553-2d76d09a	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:11.553344+00
re-1781816353869-a5abb8fa	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:13.86977+00
re-1781816361003-3caa6be2	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:21.003767+00
re-1781816368076-8856680f	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:28.076069+00
re-1781816375127-e184e107	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:35.127336+00
re-1782082214425-fef321b1	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:14.424941+00
re-1782082221533-f4ea15ca	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:21.532708+00
re-1782082228578-85c2692c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:28.578195+00
re-1782082235712-a66d19df	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:35.711873+00
re-1782082242708-4eb07b8d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:42.708248+00
re-1782082249752-45eedd77	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:49.752417+00
re-1782082256748-d029f153	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:56.747966+00
re-1782082263844-b37b49ee	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:03.84378+00
re-1781816356331-29ec0b2f	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:16.33119+00
re-1781816363337-24623b90	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:23.336959+00
re-1781816370512-256c16cf	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:30.512217+00
re-1781816377545-a895d433	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:37.545105+00
re-1782082268499-c29470ac	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:08.49918+00
re-1782082275660-92bcf091	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:15.660005+00
re-1782082282716-f05c37ea	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:22.716735+00
re-1782082289748-4e545850	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:29.748523+00
re-1782082296785-9dca0ca0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:36.784959+00
re-1782082303772-4d4b8dd6	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:43.77195+00
re-1782082310801-9a3a6798	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:50.800984+00
re-1782082317885-0a8f1242	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:57.885495+00
re-1782082329795-785766de	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:09.795428+00
re-1782082336862-997f8899	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:16.861839+00
re-1782082343977-d9704fda	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:23.977142+00
re-1782082350957-8f38ac0d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:30.957097+00
re-1782082357928-e02247d3	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:37.928056+00
re-1782082364867-4e46b3de	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:44.867352+00
re-1782082371820-0d8e8beb	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:51.820041+00
re-1782082379192-41007002	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:59.192535+00
re-1782082386291-44a5deac	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:06.291241+00
re-1782082393307-4f4ecd92	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:13.307484+00
re-1782082400451-54fbafb7	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:20.450976+00
re-1782082408067-31ed3477	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:28.066989+00
re-1782082417060-a476732c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:37.060684+00
re-1782082426094-43451b4e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:46.094276+00
re-1782082435061-041bb68b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:55.061012+00
re-1782082459336-551508f0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:54:19.336595+00
re-1781816358692-0ba55be1	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:18.692566+00
re-1781816365724-db90b0b2	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:25.724809+00
re-1781816372818-b453a2b8	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-18 20:59:32.818408+00
re-1781825561882-cfa61402	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 23:32:41.882392+00
re-1781825564383-1dcd1c48	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 23:32:44.383258+00
re-1781825646208-daa6a5a5	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 23:34:06.20833+00
re-1781825648529-451e5a6a	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-18 23:34:08.529021+00
re-1781827340741-16c29015	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:20.741299+00
re-1781827344590-0505d1f6	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:24.590355+00
re-1781827346921-86f5ae9c	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:26.921564+00
re-1781827349323-5349d058	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:29.322967+00
re-1781827351916-34e122ae	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:31.915843+00
re-1781827354313-9fec93c6	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:34.313632+00
re-1781827356678-6e7ad90a	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:36.678451+00
re-1781827359000-1e25acd5	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:38.999856+00
re-1781827361320-ba55d690	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:41.320139+00
re-1781827363679-aecd3d1d	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-19 00:02:43.679455+00
re-1781845991921-72f3fd9b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 05:13:11.917776+00
re-1781851173033-9179c43d	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 06:39:33.023367+00
re-1781863687005-663195e6	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:08:07.005115+00
re-1781863748501-99f6376e	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:09:08.501438+00
re-1781864696958-021fd6cd	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:24:56.956601+00
re-1781864826803-9270b14f	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:06.792188+00
re-1781864829213-30b77819	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:09.213028+00
re-1781864831556-000aad3c	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:11.55637+00
re-1781864833936-662727d3	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:13.936147+00
re-1781864836363-879ea274	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:16.363082+00
re-1781864838752-2f535b11	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:18.751881+00
re-1781864841340-b9ed428e	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:21.340094+00
re-1781864843995-5bcd6d11	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:23.995494+00
re-1781864846511-bec0a0bb	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:26.511331+00
re-1781864848876-a1cf7694	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:28.876618+00
re-1781864851265-cd5336ff	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:31.26566+00
re-1781864853817-fef45dde	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:33.817663+00
re-1781864856164-f09bfdc6	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:36.163925+00
re-1781864858528-ee8b4669	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:38.528162+00
re-1781864860883-30bfdc41	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:40.883582+00
re-1781864863237-e9f4b6c5	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:43.237387+00
re-1781864865710-ddb5507f	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:45.710163+00
re-1781864868103-a28abc3a	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:48.103688+00
re-1781864870477-6a67f3ba	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:50.47421+00
re-1781864872829-0b55ed71	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:52.829232+00
re-1781864875178-dddda70c	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:55.178247+00
re-1781864877669-86d6ebea	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:27:57.669742+00
re-1781864880090-ead0d40b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:00.090081+00
re-1781864882418-3b628c99	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:02.418715+00
re-1781864884755-65a6f770	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:04.755364+00
re-1781864887114-401e5f0c	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:07.11459+00
re-1781864889453-2acee66b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:09.452897+00
re-1781864891782-c4d09eb2	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:11.782322+00
re-1781864898908-09a5f105	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:18.908171+00
re-1781864906083-8601ae47	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:26.083133+00
re-1781864913116-be88ecbe	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:33.116278+00
re-1781864920187-99dee7d4	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:40.187169+00
re-1781864927350-c3394110	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:47.350428+00
re-1781864934419-8b21745a	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:54.419449+00
re-1781864941509-81204448	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:29:01.509206+00
re-1782082270836-23c4f7c3	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:10.836444+00
re-1782082278018-397529f0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:18.018159+00
re-1782082285067-94e342ff	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:25.067184+00
re-1782082292079-0339c921	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:32.078705+00
re-1782082299115-98dfe143	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:39.115093+00
re-1782082306089-7286c4b7	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:46.089487+00
re-1782082313186-59857f6f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:53.186071+00
re-1782082320312-b0411550	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:00.312168+00
re-1782082327403-d09082ec	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:07.403522+00
re-1782082334550-1718ad44	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:14.550368+00
re-1782082341550-74679f04	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:21.550745+00
re-1782082348649-72c951af	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:28.649496+00
re-1782082355627-81c9b5fb	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:35.627515+00
re-1782082362552-29827582	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:42.552009+00
re-1782082369491-1313dce6	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:49.491379+00
re-1782082376739-2ef537f4	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:56.738881+00
re-1782082383919-cf470c33	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:03.918749+00
re-1782082390980-09893112	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:10.980589+00
re-1782082398035-cfcc1dfa	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:18.035386+00
re-1782082405211-c1d14477	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:25.211148+00
re-1782082414070-8235862d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:34.070666+00
re-1782082423125-f96b3edd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:43.125336+00
re-1782082432075-dc3c8459	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:52.075443+00
re-1782082441073-77efb36f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:54:01.073564+00
re-1781864894125-b910004f	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:14.125039+00
re-1781864901401-27ca7304	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:21.401588+00
re-1781864908428-cd8fd167	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:28.428418+00
re-1781864915490-c0dddd5b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:35.490107+00
re-1781864922581-28bd184c	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:42.581201+00
re-1781864929702-b14ed496	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:49.702418+00
re-1781864936825-321a5a62	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:56.825039+00
re-1781864943860-5b7315a0	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:29:03.859853+00
re-1782082273187-64105e9f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:13.186658+00
re-1782082280326-623a13f9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:20.325791+00
re-1782082287434-97ea831f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:27.433936+00
re-1782082294453-72443825	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:34.452907+00
re-1782082301442-c8ddfd58	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:41.442369+00
re-1782082308434-46514400	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:48.434398+00
re-1782082315567-3d345d39	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:51:55.567635+00
re-1782082322677-ba7616d0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:02.676933+00
re-1782082325060-a216eacd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:05.060333+00
re-1782082332175-2c0bbb1f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:12.174697+00
re-1782082339188-e9d26e6e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:19.188242+00
re-1782082346324-4f6fb906	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:26.324657+00
re-1782082353300-47333071	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:33.300132+00
re-1782082360244-a793ecf0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:40.244061+00
re-1782082367187-14d9edc0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:47.187023+00
re-1782082374234-8647a983	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:52:54.233955+00
re-1782082381529-66f392d7	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:01.528613+00
re-1782082388628-6229005b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:08.628051+00
re-1782082395639-adf82687	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:15.638865+00
re-1782082402856-adc0914f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:22.856515+00
re-1782082411069-b4453b90	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:31.069372+00
re-1782082420070-ad770b0b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:40.070478+00
re-1782082429072-0fa30e4a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:49.072463+00
re-1782082438685-5033f8af	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:53:58.685651+00
re-1782082462060-01cca5ea	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:54:22.059924+00
re-1781864896542-e846d3f2	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:16.54244+00
re-1781864903738-8beb4fa6	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:23.738038+00
re-1781864910778-d1643eaa	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:30.778406+00
re-1781864917844-c78d4d33	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:37.844612+00
re-1781864924952-25db7664	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:44.952558+00
re-1781864932046-36ef51b4	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:52.046477+00
re-1781864939183-900c700c	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 10:28:59.182824+00
re-1781868292894-4e3bb0d8	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 11:24:52.89144+00
re-1781870177120-3a34b680	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 11:56:17.119868+00
re-1781870214842-7a0fb496	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 11:56:54.841976+00
re-1781872021778-e083bd30	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:01.777729+00
re-1781872032218-f67f9ace	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:12.218282+00
re-1781872036216-d002a0ce	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:16.215853+00
re-1781872039054-2ec533f0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:19.054118+00
re-1781872042060-ddba57da	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:22.060552+00
re-1781872045049-00858a68	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:25.049436+00
re-1781872069153-fef5f6c2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:49.152904+00
re-1781872072053-728e6b0a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:52.053615+00
re-1781872075070-cca7bdb9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 12:27:55.070445+00
re-1781877286916-3385061c	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 13:54:46.916279+00
re-1781877289580-4a24720f	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 13:54:49.580005+00
re-1781877743069-86efcea3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-19 14:02:23.069597+00
re-1781933999376-872221f7	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 05:39:59.375992+00
re-1781934001873-147285ef	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 05:40:01.872763+00
re-1781934004297-cf1ec262	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 05:40:04.297641+00
re-1781934006705-5e7c2157	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 05:40:06.705549+00
re-1781934009130-336d0e1b	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 05:40:09.130174+00
re-1781934011585-0cbdeab7	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 05:40:11.584715+00
re-1781934014014-0eca0363	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 05:40:14.013259+00
re-1781989421367-0cf9e4b2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:03:41.364848+00
re-1781989424266-7f83177d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:03:44.265239+00
re-1781989427208-7141f31c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:03:47.208502+00
re-1781989430414-487e7bec	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:03:50.41473+00
re-1781989434239-1748823a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:03:54.238937+00
re-1781989437172-1ca9f6b1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:03:57.171731+00
re-1781989440199-f5a37ef2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:00.199131+00
re-1781989443161-b6857053	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:03.161367+00
re-1781989446290-b2b9027d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:06.289833+00
re-1781989449280-18d4e287	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:09.280192+00
re-1781989452155-ca7f3b73	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:12.155442+00
re-1781989455190-cab45883	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:15.189824+00
re-1781989458162-fad3e2f2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:18.161901+00
re-1781989461132-1d5206ff	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:21.132279+00
re-1781989464314-f4edc3f2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:24.313946+00
re-1781989467169-f408038e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:27.16877+00
re-1781989470140-d640f956	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:30.139987+00
re-1781989473185-cf8ab925	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:33.184869+00
re-1781989476163-4272b1d2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:36.163171+00
re-1781989479261-76d2c2b2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:39.26138+00
re-1781989482146-60196f5f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:42.146511+00
re-1781989488162-8e159412	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:48.162139+00
re-1781989494199-5deb9b6c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:54.199005+00
re-1781989500156-4ad36056	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:00.156506+00
re-1781989506174-67adefcc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:06.173842+00
re-1781989512110-df93cdfc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:12.110406+00
re-1781989518172-d8a5a26c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:18.171742+00
re-1781989524190-212cac5d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:24.189908+00
re-1781989530153-a22db4da	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:30.15341+00
re-1781989536147-76a2ed31	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:36.146866+00
re-1781989542176-322cd0f0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:42.176342+00
re-1781989548141-52c96b22	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:48.141183+00
re-1781989554163-1dc01323	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:54.163649+00
re-1781989560122-1b42d41b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:00.121926+00
re-1781989566177-527f5d56	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:06.177592+00
re-1781989572121-64b5c67e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:12.121603+00
re-1781989578126-b2f15e5d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:18.125789+00
re-1782084092580-e7f6eef2	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:32.578709+00
re-1782084098177-69dd251f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:38.177127+00
re-1782084104143-544b0026	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:44.142825+00
re-1782084110151-99792c4e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:50.151576+00
re-1782084116177-774f9bac	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:56.177315+00
re-1782084122225-13251796	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:02.225267+00
re-1782084128106-6b725a6f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:08.106709+00
re-1782084134135-658fa881	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:14.135115+00
re-1782084140134-bad6d893	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:20.134531+00
re-1782084146133-06a4f985	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:26.133322+00
re-1782084152116-734cce18	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:32.116655+00
re-1781989485126-d30539fc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:45.126593+00
re-1781989491445-565b2f23	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:51.444628+00
re-1781989497184-bd4a37e0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:04:57.184613+00
re-1781989503176-42159754	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:03.176475+00
re-1781989509142-68611396	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:09.142032+00
re-1781989515113-a3854cb2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:15.113554+00
re-1781989521133-c836ed91	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:21.133294+00
re-1781989527183-92ecfba8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:27.183464+00
re-1781989533122-63647424	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:33.122722+00
re-1781989539140-3392f3f2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:39.139776+00
re-1781989545142-661081aa	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:45.142066+00
re-1781989551223-1b450beb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:51.223223+00
re-1781989557207-5690c58f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:05:57.206798+00
re-1781989563118-ff1409d1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:03.117808+00
re-1781989569138-9e742b30	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:09.137816+00
re-1781989575169-b7f58d19	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:15.168711+00
re-1781989581170-94d76fe0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:21.169799+00
re-1781989584185-db0d7cf8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:24.185045+00
re-1781989587126-67fcf79e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:27.126246+00
re-1781989590195-d0a43e26	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:30.195626+00
re-1781989593121-c24d6941	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:33.121072+00
re-1781989596144-8349c24c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:36.144651+00
re-1781989599127-205f58d7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:39.127294+00
re-1781989602133-720624d5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:42.133316+00
re-1781989605128-1fefcece	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:45.12841+00
re-1781989608130-a736802f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:48.129906+00
re-1781989611272-20dea1c4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:51.271678+00
re-1781989614122-7782cde2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:54.122211+00
re-1781989617170-2d8240cb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:06:57.17067+00
re-1781989620119-abcb3c38	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:00.119376+00
re-1781989623192-84f5e4e0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:03.19227+00
re-1781989626131-00511c5e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:06.130942+00
re-1781989629253-9895e043	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:09.252826+00
re-1781989632143-43ca6432	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:12.143169+00
re-1781989635124-c5cf48c6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:15.124346+00
re-1781989638137-7625b3f4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:18.137569+00
re-1781989641244-8b267998	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:21.243878+00
re-1781989644310-9db760a3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:24.309928+00
re-1781989647124-755ee9e3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:27.124236+00
re-1781989650187-212c14de	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:30.187381+00
re-1781989653154-739f68c8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:33.154291+00
re-1781989656168-94d1eb94	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:36.168219+00
re-1781989659249-b2e3d622	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:39.249084+00
re-1781989662120-454c274b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:42.120123+00
re-1781989665154-bf4aa853	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:45.153715+00
re-1781989668124-8f12eefd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:48.124358+00
re-1781989671110-92be54e6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:51.110335+00
re-1781989674157-21db7a5a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:54.157483+00
re-1781989677155-1ca4f99f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:07:57.155324+00
re-1781989680340-9e7f6515	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:00.340336+00
re-1781989686146-e7549573	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:06.146389+00
re-1781989692117-65c1c6df	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:12.116878+00
re-1781989698113-f2bef8c7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:18.113119+00
re-1781989704123-a8ea0819	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:24.123057+00
re-1781989710159-5bb84ef7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:30.159738+00
re-1781989716175-34b4e874	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:36.175424+00
re-1781989722121-d022d117	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:42.12158+00
re-1781989728122-d358308f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:48.122197+00
re-1781989734146-afc716e2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:54.145954+00
re-1781989740328-56f853b4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:00.32866+00
re-1781989746118-a6cf2c85	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:06.117942+00
re-1781989752115-d4e31bf0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:12.115031+00
re-1781989758136-d0f81179	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:18.136298+00
re-1781989764141-a8b2edf6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:24.140927+00
re-1781989770132-b11842bd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:30.132524+00
re-1781989776193-a00e524e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:36.193323+00
re-1781989782164-2540da56	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:42.164287+00
re-1781989788127-eeb5c664	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:48.127065+00
re-1781989794142-207113a3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:54.141972+00
re-1781989800119-21b1e3f2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:00.119338+00
re-1781989806149-3231c271	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:06.149414+00
re-1781989812125-eef6b594	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:12.125734+00
re-1781989818139-698e905f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:18.139645+00
re-1782084095035-86d88ec4	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:35.034846+00
re-1782084101137-a3067f72	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:41.13767+00
re-1782084107100-4ed46aff	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:47.100051+00
re-1782084113149-b9cede81	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:53.149198+00
re-1782084119241-9d6d4356	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:21:59.240774+00
re-1782084125104-ddc9d0ab	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:05.104653+00
re-1782084131123-996856e6	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:11.12281+00
re-1782084137116-a83065a1	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:17.116579+00
re-1782084143133-252914d6	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:23.133431+00
re-1782084149116-fb66fd5a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:29.116671+00
re-1782084155113-c52f7ce1	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 23:22:35.113593+00
re-1781989683285-47fbc727	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:03.284778+00
re-1781989689185-037de6fe	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:09.184952+00
re-1781989695128-fd654528	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:15.127611+00
re-1781989701119-8b9e6781	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:21.119393+00
re-1781989707113-87590d13	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:27.113622+00
re-1781989713125-56bfeebc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:33.125658+00
re-1781989719160-ef5f2815	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:39.160285+00
re-1781989725132-45ee7c2f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:45.132128+00
re-1781989731120-3e42f0e0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:51.119924+00
re-1781989737123-cec93928	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:08:57.122886+00
re-1781989743238-32943463	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:03.238467+00
re-1781989749174-5293e923	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:09.173988+00
re-1781989755115-28595abf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:15.115481+00
re-1781989761115-7fbd7f3a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:21.115415+00
re-1781989767135-a76289e7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:27.134951+00
re-1781989773121-0a6c4308	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:33.121404+00
re-1781989779188-7f630aab	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:39.187721+00
re-1781989785154-75251b8c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:45.154361+00
re-1781989791171-3c28bdee	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:51.170808+00
re-1781989797124-15f8fe57	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:09:57.123829+00
re-1781989803111-95891599	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:03.11167+00
re-1781989809160-a569d37f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:09.1606+00
re-1781989815156-2cea3898	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:15.156361+00
re-1781989821119-1b7c28e7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:21.11899+00
re-1781989824167-fcd35a19	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:24.167131+00
re-1781989827115-1bca0ac6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:27.115245+00
re-1781989830138-bd30f394	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:30.138125+00
re-1781989833124-8e263ff7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:33.124604+00
re-1781989836214-3d327a55	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:36.214715+00
re-1781989839127-6a83436f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:39.127419+00
re-1781989842173-f12d5539	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:42.172568+00
re-1781989845112-d47cfc28	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:45.112134+00
re-1781989848184-55e3067f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:48.184326+00
re-1781989851142-154679d7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:51.14272+00
re-1781989854184-2a339a69	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:54.183888+00
re-1781989857121-789d124b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:10:57.121443+00
re-1781989860133-7f8c11da	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:00.133365+00
re-1781989863114-2dfbf0bb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:03.114638+00
re-1781989866120-69dad7d2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:06.120472+00
re-1781989869121-34da4327	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:09.121746+00
re-1781989872115-dc3991b8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:12.114951+00
re-1781989875159-ec9e55af	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:15.159754+00
re-1781989881550-284f395a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:21.55021+00
re-1781989884149-997c2f40	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:24.149565+00
re-1781989887110-5d2fb5d2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:27.110213+00
re-1781989890126-99fe8f10	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:30.126766+00
re-1781989893117-76a2a423	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:33.116834+00
re-1781989896132-5e1a9553	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:36.13229+00
re-1781989899123-969cbfd3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:39.122854+00
re-1781989902143-a88d8c6d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:42.143465+00
re-1781989908194-d3c32d47	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:48.194189+00
re-1781989914182-457b725d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:54.182745+00
re-1781989920145-e08e8650	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:00.145523+00
re-1781989926113-8510be1b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:06.113099+00
re-1781989932123-037f5cbe	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:12.12337+00
re-1781989938205-957ea433	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:18.204944+00
re-1781989944137-84de66b5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:24.137166+00
re-1781989950178-23ed13f4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:30.178628+00
re-1781989956118-1c5fa61c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:36.118302+00
re-1781989962208-dc0c03f0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:42.208157+00
re-1781989968122-67f8afe8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:48.122453+00
re-1781989974170-5cd1ba2a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:54.170527+00
re-1781989983118-6f79f2f3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:03.117963+00
re-1781989989134-42e5fae5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:09.13397+00
re-1781989995125-38481529	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:15.124775+00
re-1781990001119-3b4c48cf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:21.119484+00
re-1781990007166-e1a27667	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:27.166586+00
re-1781990013184-8143f953	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:33.184251+00
re-1781990019144-6018fc90	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:39.144376+00
re-1781990025136-1fca8c40	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:45.135995+00
re-1781990031136-b9dbee03	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:51.135929+00
re-1781990037121-37f93026	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:57.120939+00
re-1781990043138-20efbb8d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:03.138228+00
re-1781990049142-f2ce54cb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:09.1424+00
re-1781990055132-2deea4b0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:15.132223+00
re-1781990061134-342921b6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:21.134038+00
re-1781990067136-dbf1ca17	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:27.136768+00
re-1781990073168-2a2624e9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:33.168071+00
re-1781990079131-041e3226	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:39.131076+00
re-1781990085126-63bbe484	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:45.126474+00
re-1781990091123-83e82918	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:51.122992+00
re-1781990097119-10cf15b9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:57.119686+00
re-1781990103149-b51b1029	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:03.149656+00
re-1781990109190-8dbfc75d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:09.189758+00
re-1781990115176-61f7e150	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:15.176077+00
re-1781990121122-d41777c0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:21.122565+00
re-1781989905139-e1929953	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:45.139625+00
re-1781989911119-5d66f221	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:51.119529+00
re-1781989917147-27731e75	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:11:57.147089+00
re-1781989923132-8d697327	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:03.13238+00
re-1781989929137-c7135774	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:09.137413+00
re-1781989935128-4f8d50fc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:15.127918+00
re-1781989941168-4c43c784	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:21.167969+00
re-1781989947164-bc890bd4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:27.164184+00
re-1781989953143-1382ff55	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:33.143623+00
re-1781989959128-6ff4ff99	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:39.128021+00
re-1781989965134-6832ef7b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:45.134523+00
re-1781989971115-4bef92bf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:51.115476+00
re-1781989977143-7d4e2f41	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:12:57.142025+00
re-1781989980185-b61ba957	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:00.185166+00
re-1781989986123-3c4bd790	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:06.122899+00
re-1781989992146-9a05b63e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:12.146522+00
re-1781989998145-0bacc18e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:18.144959+00
re-1781990004150-b2bedaf0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:24.150409+00
re-1781990010132-1cf82975	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:30.13186+00
re-1781990016119-6eb0a2cf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:36.119623+00
re-1781990022162-e7977cb9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:42.162296+00
re-1781990028135-8b9ca577	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:48.135453+00
re-1781990034247-eddeb782	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:13:54.247581+00
re-1781990040172-2936fad1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:00.172208+00
re-1781990046161-a67d1a9f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:06.161756+00
re-1781990052116-799cb212	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:12.116576+00
re-1781990058123-99173e55	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:18.122772+00
re-1781990064131-d499867d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:24.131687+00
re-1781990070127-38d575f0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:30.127609+00
re-1781990076103-fd758d1e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:36.103189+00
re-1781990082196-ac1bc071	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:42.196086+00
re-1781990088158-e868ea00	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:48.158337+00
re-1781990094137-c613302a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:14:54.137657+00
re-1781990100143-e17a4c0a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:00.143446+00
re-1781990106137-1b857b9e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:06.137747+00
re-1781990112103-6a89d33d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:12.103328+00
re-1781990118124-f48c16d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:18.124586+00
re-1781990124134-75c42edc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:24.13437+00
re-1781990127131-d06a975f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:27.131698+00
re-1781990130155-4fe0722d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:30.155254+00
re-1781990133118-f389f3f1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:33.118612+00
re-1781990136121-80c91590	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:36.121285+00
re-1781990139137-9c1573c2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:39.13751+00
re-1781990142172-bea07080	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:42.171918+00
re-1781990145140-ad2fc8ad	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:45.14053+00
re-1781990148177-4d7f03d5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:48.177303+00
re-1781990151117-937da3d1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:51.117578+00
re-1781990154137-c6f29f53	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:54.13758+00
re-1781990157116-777384b9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:15:57.115818+00
re-1781990160133-4e166c92	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:00.133629+00
re-1781990166130-6e1f9899	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:06.130651+00
re-1781990172121-9fc4ef49	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:12.1212+00
re-1781990178143-eed194bd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:18.143559+00
re-1781990184140-d80e0c85	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:24.140015+00
re-1781990190132-f8da44e3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:30.132104+00
re-1781990196104-452568b8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:36.104638+00
re-1781990202138-195c8045	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:42.138622+00
re-1781990208181-14d45063	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:48.181618+00
re-1781990214198-ed327062	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:54.198514+00
re-1781990220157-5ac28a3e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:00.156853+00
re-1781990226135-ad2499a6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:06.134717+00
re-1781990232138-5a75f305	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:12.137962+00
re-1781990241180-e7dc0a52	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:21.179893+00
re-1781990247174-21205a2e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:27.174031+00
re-1781990253367-42348fb3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:33.36743+00
re-1781990259117-7b2baa7f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:39.11738+00
re-1781990265115-c585b382	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:45.114938+00
re-1781990271135-e2dbaa3e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:51.135699+00
re-1781990277121-1473f1af	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:57.121397+00
re-1781990283119-73c094bc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:03.119407+00
re-1781990289135-6ef18159	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:09.134928+00
re-1781990295129-cae1b44a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:15.129703+00
re-1781990301129-400fd0cb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:21.129515+00
re-1781990307193-5663c0e2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:27.19295+00
re-1781990313192-241c34df	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:33.192049+00
re-1781990319129-7c1d492d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:39.129454+00
re-1781990325129-c5c73628	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:45.128823+00
re-1781990331123-77153723	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:51.123097+00
re-1781990337117-5451e638	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:57.117313+00
re-1781990343144-d206970e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:03.143991+00
re-1781990349133-4b695d43	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:09.133622+00
re-1781990355122-cb6389f4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:15.122212+00
re-1781990361117-74f8d1bc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:21.117104+00
re-1781990367135-7882b36a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:27.135563+00
re-1781990373188-3ca5aae5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:33.188164+00
re-1781990379228-d2d9ce25	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:39.22866+00
re-1781990385140-efbad296	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:45.140503+00
re-1781990391133-554427a4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:51.133256+00
re-1781990397110-cbb74e3a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:57.109854+00
re-1781990403112-79db9fee	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:03.112412+00
re-1781990409146-3a2029a3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:09.146333+00
re-1781990415128-b6538f90	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:15.12868+00
re-1781990421140-ef831861	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:21.13976+00
re-1781990163123-15e9597f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:03.123169+00
re-1781990169142-5ab83280	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:09.142568+00
re-1781990175184-02ea46a2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:15.184079+00
re-1781990181190-d5662f19	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:21.189912+00
re-1781990187126-31652d47	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:27.12605+00
re-1781990193142-9c0899a4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:33.142089+00
re-1781990199150-9b0c6645	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:39.150521+00
re-1781990205130-8777db4f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:45.129954+00
re-1781990211115-159387e9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:51.115832+00
re-1781990217126-4d1285f3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:16:57.126149+00
re-1781990223126-9bc1b0c9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:03.125904+00
re-1781990229117-b8d482ed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:09.116792+00
re-1781990235129-50623a85	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:15.129722+00
re-1781990238129-338cfa91	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:18.129648+00
re-1781990244138-9e307078	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:24.137724+00
re-1781990250158-55b5de71	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:30.15868+00
re-1781990256127-c1df8edf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:36.127011+00
re-1781990262148-ba260ce2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:42.148241+00
re-1781990268133-08a9bad4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:48.133696+00
re-1781990274175-046e7b55	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:17:54.175671+00
re-1781990280201-4e97160c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:00.201084+00
re-1781990286127-a0d5ed93	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:06.127228+00
re-1781990292135-e3765730	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:12.135178+00
re-1781990298108-835d2224	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:18.108392+00
re-1781990304145-d2ee9574	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:24.144861+00
re-1781990310169-c16cb2c0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:30.169479+00
re-1781990316173-1d03cdeb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:36.173718+00
re-1781990322141-a54214b7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:42.141132+00
re-1781990328154-3bdcb1a5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:48.154223+00
re-1781990334154-56b34c8d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:18:54.154583+00
re-1781990340180-3c856608	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:00.180168+00
re-1781990346192-bd84e19b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:06.192053+00
re-1781990352131-c778ac7f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:12.130756+00
re-1781990358143-6a687cff	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:18.143185+00
re-1781990364144-8c69efed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:24.144575+00
re-1781990370133-94bb031f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:30.133432+00
re-1781990376114-04656022	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:36.114231+00
re-1781990382130-a64ae49a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:42.130698+00
re-1781990388115-f4857c36	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:48.115631+00
re-1781990394153-072557da	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:19:54.152905+00
re-1781990400144-2b434141	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:00.144089+00
re-1781990406184-3bc95335	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:06.18419+00
re-1781990412199-90391357	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:12.198859+00
re-1781990418140-40200008	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:18.140122+00
re-1781990424156-946d6b17	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:24.155636+00
re-1781990427136-9d060746	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:27.135928+00
re-1781990430164-ec0555d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:30.163883+00
re-1781990433151-d623a236	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:33.151393+00
re-1781990436155-8ff608d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:36.155122+00
re-1781990439187-8630839a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:39.186945+00
re-1781990445189-59289e1f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:45.189268+00
re-1781990451141-df13d498	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:51.141455+00
re-1781990457130-05827aed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:57.130021+00
re-1781990463158-51a1eada	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:03.158226+00
re-1781990469156-ec9830ed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:09.15666+00
re-1781990475150-0e6d34c5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:15.150136+00
re-1781990481146-2b65a457	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:21.146373+00
re-1781990487119-b76c010c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:27.118919+00
re-1781990493187-f20f3759	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:33.187603+00
re-1781990499270-8d98f097	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:39.270665+00
re-1781990505196-561ddb38	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:45.195994+00
re-1781990511335-bc0d93c9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:51.33486+00
re-1781990517180-b74b7852	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:57.179743+00
re-1781990523124-2e350289	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:03.124063+00
re-1781990529170-e902c165	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:09.170541+00
re-1781990535155-194b1053	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:15.155052+00
re-1781990541714-9efb824f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:21.714563+00
re-1781990547166-77f5823b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:27.166084+00
re-1781990553155-1140ee81	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:33.155061+00
re-1781990559182-d8005d4b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:39.181943+00
re-1781990565172-83d0999b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:45.172463+00
re-1781990571213-a6bf4de6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:51.213548+00
re-1781990577213-92500ae4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:57.213656+00
re-1781990583184-6d72f274	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:03.184134+00
re-1781990589167-08800981	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:09.167738+00
re-1781990595163-1e477fae	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:15.163551+00
re-1781990601253-b585eaae	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:21.253343+00
re-1781990607140-c07d3881	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:27.140641+00
re-1781990613177-33932e90	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:33.177545+00
re-1781990619179-3134d108	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:39.178868+00
re-1781990625227-3b290733	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:45.227089+00
re-1781990631171-ef3bc28f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:51.171458+00
re-1781990637220-ae7900cb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:57.220055+00
re-1781990643293-ea3afe9e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:03.293567+00
re-1781990649201-ad2abe27	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:09.2009+00
re-1781990655196-47956731	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:15.195927+00
re-1781990661151-85df20c9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:21.150862+00
re-1781990667200-a422880c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:27.200366+00
re-1781990673148-8cf41105	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:33.148439+00
re-1781990679198-9f8bcccd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:39.198413+00
re-1781990685165-745bef5a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:45.165109+00
re-1781990691174-0f454133	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:51.174253+00
re-1781990697147-fa9985e9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:57.147708+00
re-1781990703166-e717c846	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:03.166628+00
re-1781990709271-7c0bf09b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:09.271419+00
re-1781990715193-6f456847	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:15.193332+00
re-1781990721157-acf9f27b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:21.157688+00
re-1781990727159-62a50a67	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:27.158807+00
re-1781990442129-95fac93f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:42.128847+00
re-1781990448128-52ee721e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:48.128587+00
re-1781990454137-a5153aff	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:20:54.137718+00
re-1781990460142-321a91d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:00.142507+00
re-1781990466125-bde0cbb3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:06.125663+00
re-1781990472118-181fcb7e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:12.117858+00
re-1781990478191-dffcab2e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:18.191341+00
re-1781990484152-5f42cd4c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:24.152724+00
re-1781990490142-b17ee05b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:30.1428+00
re-1781990496124-ac175cd2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:36.123713+00
re-1781990502131-91fa63f2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:42.130823+00
re-1781990508145-570b0a6d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:48.145333+00
re-1781990514161-97a506a3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:21:54.161355+00
re-1781990520152-e06ed518	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:00.15208+00
re-1781990526162-c73cb4b1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:06.162395+00
re-1781990532124-dbd62b60	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:12.124+00
re-1781990538208-11709a07	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:18.208248+00
re-1781990544228-66d3c58a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:24.228339+00
re-1781990550168-6e691f06	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:30.168522+00
re-1781990556148-ea6c74f3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:36.148145+00
re-1781990562160-038d9ffb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:42.160426+00
re-1781990568145-9c3843d7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:48.145295+00
re-1781990574153-930bad2f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:22:54.152865+00
re-1781990580147-9a70011e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:00.14673+00
re-1781990586147-88f39ba1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:06.147177+00
re-1781990592173-48f1cd62	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:12.173329+00
re-1781990598174-00adb02c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:18.174045+00
re-1781990604226-e18ad9ea	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:24.225918+00
re-1781990610235-9f951e52	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:30.235696+00
re-1781990616159-192ba646	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:36.159579+00
re-1781990622191-a6d78e30	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:42.191466+00
re-1781990628154-459573c6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:48.154772+00
re-1781990634193-62420419	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:23:54.193256+00
re-1781990640152-af24f729	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:00.152318+00
re-1781990646153-95894515	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:06.153596+00
re-1781990652163-c1cb688d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:12.163154+00
re-1781990658182-43f820ec	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:18.182152+00
re-1781990664152-cfcc7928	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:24.151843+00
re-1781990670217-4d631fbf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:30.217403+00
re-1781990676261-79c16e10	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:36.261342+00
re-1781990682200-3b4a9ceb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:42.200057+00
re-1781990688171-1646491e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:48.171511+00
re-1781990694213-e4debb8d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:24:54.212949+00
re-1781990700166-b489743e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:00.166825+00
re-1781990706170-d95c1291	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:06.16984+00
re-1781990712160-9b2fecdf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:12.160611+00
re-1781990718164-7dae377b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:18.1642+00
re-1781990724186-d9eb467f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:24.18672+00
re-1781990730158-ac429a17	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:30.158062+00
re-1781990733155-1772439a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:33.155007+00
re-1781990739178-05c2a1a5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:39.178397+00
re-1781990745149-61271687	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:45.149493+00
re-1781990751155-18ebe9c4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:51.155358+00
re-1781990757177-28e162f3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:57.177007+00
re-1781990763162-a0e07211	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:03.162211+00
re-1781990769247-f9c0f4fb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:09.247367+00
re-1781990775256-48e2e8ff	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:15.255881+00
re-1781990781249-dfeb4120	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:21.249085+00
re-1781990736159-18c218ea	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:36.159505+00
re-1781990742174-1c8e24df	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:42.174206+00
re-1781990748191-c253f45d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:48.190883+00
re-1781990754159-b41039e5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:25:54.159602+00
re-1781990760170-980862a2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:00.1703+00
re-1781990766162-b027a625	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:06.162195+00
re-1781990772159-804fd228	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:12.15953+00
re-1781990778162-3c92ea1a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:18.162675+00
re-1781990784182-c44587af	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:24.182151+00
re-1781990787166-01a04e90	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:27.165956+00
re-1781990790178-e084bba8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:30.178338+00
re-1781990793173-f0ba79dd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:33.17334+00
re-1781990796156-a3589256	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:36.155665+00
re-1781990799194-7810641d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:39.194222+00
re-1781990802245-fdd69c18	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:42.245611+00
re-1781990805166-232417fe	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:45.165998+00
re-1781990808183-cb10a1f7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:48.183205+00
re-1781990811194-e69ad10f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:51.193863+00
re-1781990814213-73ec6158	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:54.213078+00
re-1781990817172-3d9e06a0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:26:57.172483+00
re-1781990820185-ebdb90c9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:00.18571+00
re-1781990823167-65533eaf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:03.167317+00
re-1781990826165-0783a013	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:06.165411+00
re-1781990829205-f313b4cb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:09.204848+00
re-1781990832245-a2b10159	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:12.245519+00
re-1781990835168-34ea84f6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:15.167919+00
re-1781990838190-c1894f8d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:18.189997+00
re-1781990841178-cf8ef27c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:21.178612+00
re-1781990844214-a7785e6e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:24.213763+00
re-1781990847509-6d5774fa	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-20 21:27:27.50926+00
re-1782065363557-1bef71fb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:23.55653+00
re-1782065366518-b15998ce	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:26.518328+00
re-1782065370002-6e06afda	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:30.002429+00
re-1782065372570-410ce87f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:32.569724+00
re-1782065375643-afd6112a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:35.642934+00
re-1782065378558-af2d0ad5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:38.558011+00
re-1782065381534-63fec958	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:41.53462+00
re-1782065385095-27d20b98	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:45.095392+00
re-1782065387564-0f262318	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:47.564683+00
re-1782065390659-21cbeff2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:50.659727+00
re-1782065393830-2469750d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:53.830161+00
re-1782065396605-c7c4c6ca	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:56.605265+00
re-1782065399685-6f4e8b37	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:09:59.685826+00
re-1782065403716-da3b6573	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:03.715915+00
re-1782065407387-e1f17486	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:07.387702+00
re-1782065410555-fdb0365a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:10.55469+00
re-1782065413544-e4abe2bb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:13.544327+00
re-1782065416617-e69cd676	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:16.617346+00
re-1782065419525-b70438f9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:19.525085+00
re-1782065422557-c27f7c69	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:22.557016+00
re-1782065428535-cc2cdd05	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:28.535296+00
re-1782065434548-10b29e15	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:34.548333+00
re-1782065440724-987b16bf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:40.724463+00
re-1782065446552-5f118928	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:46.552225+00
re-1782065452512-7e6f070c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:52.51279+00
re-1782065458515-2acbd4b4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:58.514954+00
re-1782065464525-04d7b34a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:04.525642+00
re-1782065470506-c5be1cfe	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:10.50633+00
re-1782065476521-d94a8f4f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:16.520847+00
re-1782065482542-95906c9a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:22.542686+00
re-1782065488540-03e4ad61	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:28.540601+00
re-1782065494524-11c05817	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:34.524096+00
re-1782065500515-78d9b1d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:40.515827+00
re-1782065506517-a53771e6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:46.517112+00
re-1782065512524-338e1e98	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:52.523745+00
re-1782065518532-2e0aa0d1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:58.531852+00
re-1782065524528-04349ba9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:04.528178+00
re-1782065530527-0358d46a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:10.527152+00
re-1782065536515-ba7d3077	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:16.5155+00
re-1782065542549-d18f96b0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:22.549468+00
re-1782065548509-08df8ac5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:28.508771+00
re-1782065554525-ef91aef4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:34.525307+00
re-1782065560508-6ec04b09	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:40.508462+00
re-1782065566529-8d9feff8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:46.529752+00
re-1782065572527-bbec75de	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:52.526954+00
re-1782065578539-5e30f39c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:58.539339+00
re-1782065584510-26d1ac90	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:04.510807+00
re-1782065590539-6c620f09	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:10.539426+00
re-1782065596532-dbe92dc1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:16.532604+00
re-1782065602753-b1ab8c4e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:22.753733+00
re-1782065608539-10b2ea94	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:28.538833+00
re-1782065614530-9ba0557b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:34.530051+00
re-1782065620508-9601436b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:40.508584+00
re-1782065626532-1f10a45d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:46.532195+00
re-1782065632513-6229a6fc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:52.51336+00
re-1782065638524-e14ea63e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:58.524103+00
re-1782065644521-91f3c244	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:04.521442+00
re-1782065650523-081b0f12	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:10.52379+00
re-1782065656520-5e9d9cb4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:16.520389+00
re-1782065662520-46d62366	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:22.519871+00
re-1782065668533-827b99d1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:28.532966+00
re-1782065425519-47783c33	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:25.519142+00
re-1782065431537-90fffc48	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:31.536732+00
re-1782065437630-2d06f30e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:37.629843+00
re-1782065443519-44ef4683	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:43.519325+00
re-1782065449520-9ca46913	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:49.520464+00
re-1782065455515-e375ad36	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:10:55.515699+00
re-1782065461533-22375ea2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:01.532933+00
re-1782065467535-b21c34df	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:07.535308+00
re-1782065473519-e2c59d4b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:13.519328+00
re-1782065479527-f06c0bee	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:19.526739+00
re-1782065485509-33b5653f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:25.509409+00
re-1782065491515-ece7b31b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:31.515666+00
re-1782065497524-7594f17d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:37.524268+00
re-1782065503527-d99017c4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:43.527782+00
re-1782065509513-a3aaad17	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:49.513745+00
re-1782065515587-ac594cc1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:11:55.586966+00
re-1782065521507-c20dd7d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:01.507773+00
re-1782065527521-cb28a22d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:07.521209+00
re-1782065533534-d3023d0d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:13.533886+00
re-1782065539515-f45795ac	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:19.515602+00
re-1782065545537-acaf52cd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:25.536784+00
re-1782065551511-6f805682	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:31.511582+00
re-1782065557506-05e1de71	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:37.506222+00
re-1782065563509-4db0b732	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:43.509724+00
re-1782065569508-8b5e8470	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:49.50785+00
re-1782065575543-791da3cd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:12:55.543301+00
re-1782065581527-613d03c2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:01.527678+00
re-1782065587527-51b1d5ec	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:07.527061+00
re-1782065593557-ecef396a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:13.557433+00
re-1782065599537-b433fbd7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:19.537197+00
re-1782065605536-e0627dd6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:25.536589+00
re-1782065611549-c1108d0e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:31.54959+00
re-1782065617526-c6114a97	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:37.526362+00
re-1782065623517-7d72604c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:43.517663+00
re-1782065629526-496b2ece	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:49.52653+00
re-1782065635516-d3ba9e5a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:13:55.516718+00
re-1782065641511-16b6ba50	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:01.511361+00
re-1782065647514-248523a2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:07.514174+00
re-1782065653524-6c8024a1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:13.524757+00
re-1782065659512-d2a32fe9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:19.51192+00
re-1782065665538-cf2f2927	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:25.538427+00
re-1782065671526-9052d8d1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:31.526445+00
re-1782065674530-b5e82cd2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:34.530189+00
re-1782065677512-de474d5d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:37.512684+00
re-1782065680521-78ed0fd4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:40.520949+00
re-1782065683522-0e6aeb11	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:43.522455+00
re-1782065686514-8eadc4e0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:46.514744+00
re-1782065689509-1889a9d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:49.509598+00
re-1782065692519-b9e3040f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:52.519754+00
re-1782065695528-cddcfe37	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:55.527833+00
re-1782065701531-f19e1515	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:01.531635+00
re-1782065707511-3bbaf0ac	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:07.511016+00
re-1782065713523-fa449ca1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:13.522899+00
re-1782065719514-3c90bfc2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:19.514383+00
re-1782065725513-455177db	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:25.512883+00
re-1782065731523-21616fdf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:31.522871+00
re-1782065737519-106c3038	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:37.519645+00
re-1782065743520-88c6972a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:43.520451+00
re-1782065749519-b6f444b8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:49.518942+00
re-1782065755505-127e85ee	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:55.505562+00
re-1782065761511-a0b9a472	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:01.511385+00
re-1782065767521-1d2dbced	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:07.521807+00
re-1782065773525-b70f78ed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:13.524688+00
re-1782065779517-4c082d39	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:19.5177+00
re-1782065785518-64302a2a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:25.51799+00
re-1782065791512-fb3280ce	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:31.512043+00
re-1782065797515-f5e0496c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:37.515692+00
re-1782065803511-c015c9ac	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:43.51132+00
re-1782065809523-83d39cbe	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:49.523105+00
re-1782065815530-927140a4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:55.530638+00
re-1782065821572-7592ee2a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:01.572151+00
re-1782065827519-34b59dab	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:07.518968+00
re-1782065833523-cc9f12b6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:13.523137+00
re-1782065839513-4a279a16	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:19.513669+00
re-1782065845504-a60d5a73	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:25.504233+00
re-1782065851530-b42235ad	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:31.529972+00
re-1782065857529-4c528448	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:37.52884+00
re-1782065863527-1b01702e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:43.526897+00
re-1782065869507-e74d23a0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:49.507341+00
re-1782065875512-c64d91ab	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:55.512536+00
re-1782065881504-9440e2cf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:01.504221+00
re-1782065887515-ac09fa98	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:07.515294+00
re-1782065893530-a9cca534	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:13.530137+00
re-1782065899521-6ed64c4c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:19.520828+00
re-1782065905522-b65b8b55	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:25.521958+00
re-1782065911504-2074830a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:31.504531+00
re-1782065917514-4b25bfcf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:37.514062+00
re-1782065923550-d6529f70	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:43.55068+00
re-1782065929515-732a450b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:49.514817+00
re-1782065935521-804e2c14	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:55.521465+00
re-1782065941523-90af6148	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:01.523692+00
re-1782065947511-b177fde8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:07.51151+00
re-1782065953543-83a51ddc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:13.542865+00
re-1782065959515-b88385a0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:19.515581+00
re-1782065968524-ff4007e6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:28.524519+00
re-1782065974516-d385cbdf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:34.515921+00
re-1782065980518-216ed44e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:40.51828+00
re-1782065986517-9a1bc7da	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:46.517011+00
re-1782065698517-4abcc282	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:14:58.516978+00
re-1782065704523-a88d531a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:04.52374+00
re-1782065710517-b4ab53ed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:10.517696+00
re-1782065716518-25ad701e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:16.518725+00
re-1782065722535-e879ce2c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:22.535177+00
re-1782065728522-2ef71159	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:28.52196+00
re-1782065734518-7da62bee	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:34.518466+00
re-1782065740506-34517bfc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:40.506173+00
re-1782065746525-ad49bdb0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:46.525593+00
re-1782065752512-e2fc36f0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:52.512236+00
re-1782065758522-5d5166cc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:15:58.522491+00
re-1782065764507-5c233223	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:04.507551+00
re-1782065770516-25c1c00f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:10.515877+00
re-1782065776530-892f3b4b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:16.530791+00
re-1782065782534-5daaa79b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:22.534112+00
re-1782065788532-eed46e15	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:28.532591+00
re-1782065794525-ca607c18	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:34.525042+00
re-1782065800512-eaccae65	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:40.512068+00
re-1782065806505-2aef001a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:46.504873+00
re-1782065812503-5f9a13d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:52.503246+00
re-1782065818537-da21328f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:16:58.536876+00
re-1782065824520-38fad457	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:04.519939+00
re-1782065830526-b9a9e4d9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:10.526789+00
re-1782065836553-0721fa80	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:16.5533+00
re-1782065842556-b1296d71	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:22.555896+00
re-1782065848542-d6f781fd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:28.542034+00
re-1782065854518-460f37f5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:34.518354+00
re-1782065860513-2a573214	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:40.513291+00
re-1782065866528-01b486cd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:46.528458+00
re-1782065872526-4e885962	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:52.526182+00
re-1782065878527-e4c5a0b4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:17:58.527596+00
re-1782065884511-b3d25c19	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:04.511409+00
re-1782065890514-8834d3e3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:10.514542+00
re-1782065896518-be72f3fe	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:16.518509+00
re-1782065902538-667d2300	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:22.537811+00
re-1782065908537-7dff1788	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:28.537543+00
re-1782065914516-9b5d8824	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:34.516092+00
re-1782065920515-6094fe01	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:40.515213+00
re-1782065926517-4ff40cb1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:46.51741+00
re-1782065932513-d952ee04	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:52.513253+00
re-1782065938530-fbb41eab	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:18:58.529995+00
re-1782065944512-86f8da10	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:04.512242+00
re-1782065950537-c5a69eed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:10.537166+00
re-1782065956504-a50f0daf	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:16.504342+00
re-1782065962545-f15afaff	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:22.543651+00
re-1782065965512-a62ec44a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:25.512071+00
re-1782065971519-17bfa8aa	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:31.519677+00
re-1782065977537-65761875	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:37.536913+00
re-1782065983513-2895ab77	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:43.513625+00
re-1782065989524-d843f056	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:49.524572+00
re-1782065995507-f7b4d59f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:55.507795+00
re-1782066001512-37b6929c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:01.511813+00
re-1782066007506-4f3c093c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:07.506652+00
re-1782066013515-161364be	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:13.515305+00
re-1782066019528-e1de97f1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:19.528688+00
re-1782066025503-05065dc3	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:25.503617+00
re-1782066031506-e854649e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:31.506378+00
re-1782066037514-7733542b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:37.513924+00
re-1782066043514-a291d525	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:43.513985+00
re-1782066049515-af53c4d9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:49.515307+00
re-1782066055519-905e3a3c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:55.519809+00
re-1782066061518-d4d47369	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:01.518242+00
re-1782066067512-fe21cb84	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:07.512239+00
re-1782066073509-94e0c41c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:13.508958+00
re-1782066079526-3747a64d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:19.525945+00
re-1782066085522-d88da3cc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:25.522693+00
re-1782066091517-8f16210d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:31.517067+00
re-1782065992528-394b05c8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:52.527937+00
re-1782065998536-10589a80	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:19:58.536481+00
re-1782066004515-41afbf21	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:04.515248+00
re-1782066010513-a8c9d46b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:10.513133+00
re-1782066016521-656427e5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:16.521517+00
re-1782066022547-35a35d5c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:22.547058+00
re-1782066028507-f07fb2a6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:28.507153+00
re-1782066034514-8f0d5c00	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:34.514533+00
re-1782066040506-ef8fd6fb	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:40.506795+00
re-1782066046516-9dea9657	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:46.5158+00
re-1782066052526-c6e2e0d0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:52.526467+00
re-1782066058531-08f033e5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:20:58.531083+00
re-1782066064519-639db856	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:04.519096+00
re-1782066070512-e0c2b071	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:10.512789+00
re-1782066076531-93160d02	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:16.531465+00
re-1782066082537-ca406e93	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:22.534577+00
re-1782066088517-85dde9a9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:28.51713+00
re-1782066094522-6394ee6e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:34.521741+00
re-1782066097513-0234ae6d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:37.513868+00
re-1782066100505-b0ddd9bd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:40.504937+00
re-1782066103514-d86f7ba4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:43.514373+00
re-1782066106519-7ceb49ed	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:46.519601+00
re-1782066109529-08d35afc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:49.529367+00
re-1782066112519-1c3bca24	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:52.519746+00
re-1782066115507-85d19d8a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:55.507181+00
re-1782066118518-f55996e8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:21:58.518498+00
re-1782066121515-64adc062	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:01.515104+00
re-1782066124513-e99ac644	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:04.513009+00
re-1782066127509-8218a324	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:07.509627+00
re-1782066130507-f7726284	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:10.507808+00
re-1782066133514-6f7f1965	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:13.513989+00
re-1782066136532-4a84126c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:16.532274+00
re-1782066139511-dab33a10	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:19.511781+00
re-1782066142634-926b6715	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:22.634053+00
re-1782066145511-37c62221	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:25.510889+00
re-1782066148508-15516756	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:28.508623+00
re-1782066151521-d01695d7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:31.520812+00
re-1782066154518-28d6ff44	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:34.518104+00
re-1782066157515-1562f47e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:37.515084+00
re-1782066160529-bfb3238e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:40.529014+00
re-1782066163515-34ee2984	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:43.515599+00
re-1782066166523-12044ed1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:46.522999+00
re-1782066169535-f78f04ea	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:49.535095+00
re-1782066172510-55e4bb0c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:52.510871+00
re-1782066175515-8688c574	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:55.51581+00
re-1782066178515-a3a8ec44	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:22:58.514788+00
re-1782066181522-eb5f2c4d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:01.522178+00
re-1782066184506-1b9d274b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:04.506636+00
re-1782066187505-5885b24b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:07.50542+00
re-1782066190525-08e0bab0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:10.525268+00
re-1782066199516-6e5d6d40	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:19.516351+00
re-1782066208511-da7610c7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:28.511621+00
re-1782066214507-b2b90a60	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:34.507662+00
re-1782066220543-113b6558	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:40.543031+00
re-1782066226554-2bd8508c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:46.553946+00
re-1782066232515-ca2a4560	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:52.515025+00
re-1782066238531-56a5b5ac	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:58.531546+00
re-1782066244517-6889c801	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:04.517332+00
re-1782066250556-590ac4de	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:10.55618+00
re-1782066256518-11b4f6d6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:16.518265+00
re-1782066263333-cd2b3c92	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:23.333728+00
re-1782066269523-754c53a8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:29.523575+00
re-1782066275524-c3da1299	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:35.523932+00
re-1782066281597-66572b9b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:41.596975+00
re-1782066287520-dc3bc390	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:47.520564+00
re-1782066293550-c68f692a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:53.550001+00
re-1782066299546-0a72dfc2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:59.546044+00
re-1782066305535-5a232c88	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:05.535201+00
re-1782066311666-a0ce250b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:11.665843+00
re-1782066317526-45eff837	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:17.526035+00
re-1782066323519-d16a075d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:23.519618+00
re-1782066329509-51c18e8e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:29.50962+00
re-1782066335516-fc09218f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:35.516756+00
re-1782066341508-e0b62834	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:41.508217+00
re-1782066347506-b5fcf288	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:47.506306+00
re-1782066353515-4e4294d7	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:53.515475+00
re-1782066359520-077cc2ec	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:59.520374+00
re-1782066365532-a22ce8ef	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:05.532228+00
re-1782066371522-f712a288	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:11.522322+00
re-1782066377503-7f540dda	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:17.503597+00
re-1782066383521-36c0fc52	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:23.521403+00
re-1782066389506-aa56e9d8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:29.506011+00
re-1782066395511-a436a6a5	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:35.511359+00
re-1782066401527-a0558d6f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:41.52709+00
re-1782066407513-cc980e8a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:47.513094+00
re-1782066413521-91a8a126	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:53.521266+00
re-1782066419516-4dced7a6	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:59.516754+00
re-1782066425519-a13310e9	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:27:05.519386+00
re-1782066433595-acc61981	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:27:13.595672+00
re-1782066193511-4d18a984	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:13.51119+00
re-1782066196505-bdb43a84	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:16.505804+00
re-1782066202525-64a73b71	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:22.52486+00
re-1782066205516-020f7b1d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:25.515966+00
re-1782066211511-ace5e31e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:31.511153+00
re-1782066217506-5d50f3fc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:37.506382+00
re-1782066223526-99aad5c1	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:43.526147+00
re-1782066229515-09f60fa4	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:49.515293+00
re-1782066235515-56508aa2	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:23:55.515816+00
re-1782066241885-ff25aa44	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:01.885714+00
re-1782066247520-a320eed0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:07.519883+00
re-1782066253536-fd1fefb0	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:13.536027+00
re-1782066259530-1e12e9ba	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:19.530603+00
re-1782066266515-e797ecdc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:26.515845+00
re-1782066272519-5eb72013	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:32.519504+00
re-1782066278541-338c7e87	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:38.541455+00
re-1782066284643-f0ed4c3c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:44.642971+00
re-1782066290513-dae0bb26	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:50.513402+00
re-1782066296512-d287095d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:24:56.511919+00
re-1782066302523-70100807	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:02.52293+00
re-1782066308768-7cc32b5d	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:08.768117+00
re-1782066314510-f391ac5a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:14.510144+00
re-1782066320510-8059cb92	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:20.509978+00
re-1782066326507-266c087a	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:26.507534+00
re-1782066332529-d4d6dccc	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:32.529072+00
re-1782066338530-92940e88	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:38.530131+00
re-1782066344503-25188a21	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:44.50379+00
re-1782066350509-22a91062	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:50.508992+00
re-1782066356514-0fd498cd	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:25:56.514754+00
re-1782066362526-fec2d904	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:02.52657+00
re-1782066368513-c3ade749	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:08.513461+00
re-1782066374504-e3c2be78	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:14.50432+00
re-1782066380539-edf492ab	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:20.539118+00
re-1782066386519-9d8a4416	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:26.519605+00
re-1782066392516-2904e247	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:32.516749+00
re-1782066398521-f5a55e4f	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:38.521679+00
re-1782066404509-ad60602b	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:44.509187+00
re-1782066410519-e66bada8	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:50.51938+00
re-1782066416511-30673f21	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:26:56.5112+00
re-1782066422518-ab18be6c	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:27:02.518229+00
re-1782066428544-de2d6c1e	reel-1781870490939-bd73f2f5	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	watch	{"signal": "watch"}	2026-06-21 18:27:08.54438+00
re-1782081775135-e2e77b31	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:42:55.135427+00
re-1782081781357-16490713	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:01.357511+00
re-1782081783709-21dd4d33	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:03.709315+00
re-1782081786042-f2c62408	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:06.041948+00
re-1782081788376-1c36430e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:08.375918+00
re-1782081790792-c8bbb608	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:10.791812+00
re-1782081793155-dff7f768	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:13.154901+00
re-1782081795546-cc47fe97	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:15.546541+00
re-1782081797910-bdcb1f0a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:17.909721+00
re-1782081802597-37afd0fb	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:22.597369+00
re-1782081809741-f5e692f8	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:29.741207+00
re-1782081816742-a25e3b07	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:36.742221+00
re-1782081823864-480585da	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:43.863642+00
re-1782081830814-46ce61ed	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:50.814005+00
re-1782081837804-300d36dc	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:57.804417+00
re-1782081844846-c6c07d73	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:04.846451+00
re-1782081800255-6f34afc9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:20.254658+00
re-1782081807350-1b86b6fd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:27.350546+00
re-1782081814425-74bef117	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:34.425127+00
re-1782081821472-46806d2a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:41.471869+00
re-1782081828490-78ca14ea	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:48.489762+00
re-1782081835492-3461a2bd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:55.49204+00
re-1782081842469-ebd20697	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:02.469299+00
re-1782081804959-5e1b282e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:24.959585+00
re-1782081812103-f57c6042	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:32.103261+00
re-1782081819077-43a7feb8	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:39.077496+00
re-1782081826167-7afc5b12	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:46.167685+00
re-1782081833176-86c10c16	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:43:53.176416+00
re-1782081840116-58c404f3	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:00.116488+00
re-1782081847198-0384c515	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:07.197852+00
re-1782081849526-7ae909e9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:09.526509+00
re-1782081851920-67e6a1db	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:11.920728+00
re-1782081854257-c20f276c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:14.257035+00
re-1782081856585-6991c4f5	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:16.585309+00
re-1782081858901-7e223e4d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:18.901732+00
re-1782081861221-78572f38	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:21.221187+00
re-1782081863537-4131db02	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:23.537616+00
re-1782081865861-5d8b82dd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:25.861306+00
re-1782081868204-d572448a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:28.204162+00
re-1782081870510-9becf4a3	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:30.509705+00
re-1782081872818-48cc70d7	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:32.818579+00
re-1782081875174-85b3c933	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:35.174253+00
re-1782081877584-80203111	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:37.584655+00
re-1782081879950-9e27fba0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:39.95048+00
re-1782081882288-f2929c42	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:42.288049+00
re-1782081884617-9bcc9acd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:44.617211+00
re-1782081886978-5479546e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:46.978494+00
re-1782081889305-97dc37f5	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:49.305576+00
re-1782081891627-b2b2faeb	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:51.627179+00
re-1782081893967-bfeffd0b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:53.966939+00
re-1782081896365-d641f884	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:56.364777+00
re-1782081898696-8e540ae5	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:44:58.696256+00
re-1782081901095-abfc5f0c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:01.09527+00
re-1782081903455-f609e769	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:03.455389+00
re-1782081905778-3d2ce1d0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:05.778556+00
re-1782081908093-8749526d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:08.09297+00
re-1782081910486-cab4d811	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:10.4859+00
re-1782081912815-d6b041c0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:12.815326+00
re-1782081915183-60789986	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:15.182944+00
re-1782081917600-342a12f3	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:17.600065+00
re-1782081919922-3770ff2d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:19.921745+00
re-1782081922243-3720836c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:22.243397+00
re-1782081924578-e52ce325	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:24.577889+00
re-1782081926982-33908d24	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:26.982287+00
re-1782081929312-b8f50b42	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:29.312436+00
re-1782081931688-2b016b9c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:31.688301+00
re-1782081934089-95c56c2d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:34.089232+00
re-1782081936409-f3d521ef	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:36.408972+00
re-1782081938718-674e3531	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:38.718106+00
re-1782081941117-8a7c83a5	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:41.117295+00
re-1782081943480-a803b35f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:43.480575+00
re-1782081945828-5f7281cb	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:45.82838+00
re-1782081948186-3ff912ba	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:48.186445+00
re-1782081955352-312db62e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:55.352051+00
re-1782081962501-18692119	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:02.501342+00
re-1782081969541-30d0b49d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:09.541171+00
re-1782081976594-0e9e5db6	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:16.594131+00
re-1782081983598-e5c78298	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:23.59838+00
re-1782081990582-53142f48	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:30.582468+00
re-1782081997617-c3c303b5	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:37.617024+00
re-1782082004708-377ec864	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:44.708021+00
re-1782082011776-c660ac0b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:51.776206+00
re-1782082019010-297f879c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:59.010305+00
re-1782082026682-9809ba82	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:06.682576+00
re-1782082033888-3dbaff25	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:13.88817+00
re-1782082040851-aa746c6b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:20.851493+00
re-1782082047879-3c8edc04	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:27.879684+00
re-1782082054955-1da7be1c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:34.955681+00
re-1782082061949-6a5045d9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:41.949254+00
re-1782082069005-b6bb3b98	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:49.004762+00
re-1782082076071-9e8a49f2	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:56.070625+00
re-1782082083003-04c826e5	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:03.002816+00
re-1782082090041-e2e3b1cb	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:10.041433+00
re-1782082097101-05b987b3	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:17.101449+00
re-1782082104048-0a8d4c7c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:24.048595+00
re-1782082111104-7c263c2b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:31.103831+00
re-1782082118138-fa0802e9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:38.138499+00
re-1782082125201-89b2d40e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:45.201687+00
re-1782082132215-0dfe525a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:52.214906+00
re-1782082139266-8cfb8093	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:59.266146+00
re-1782082146499-6761ade7	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:06.49917+00
re-1782082153535-b1e5b3ac	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:13.535183+00
re-1782082160604-bf46be3a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:20.603898+00
re-1782082167726-fca6f370	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:27.725804+00
re-1782082174697-5e445645	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:34.69702+00
re-1782082181675-4d3418d4	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:41.675152+00
re-1782082188623-16159f0a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:48.622902+00
re-1782082195562-18481249	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:55.56243+00
re-1782082202572-e7146b42	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:02.572193+00
re-1782081950627-2319de02	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:50.627442+00
re-1782081957667-8c2f4e4f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:57.666718+00
re-1782081964842-ed97e8bd	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:04.842067+00
re-1782081971868-b170888b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:11.868412+00
re-1782081978956-690877c8	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:18.95653+00
re-1782081985932-11b7a357	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:25.932537+00
re-1782081992928-c325ddec	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:32.928129+00
re-1782081999974-cc42650d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:39.974415+00
re-1782082007068-68ee1039	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:47.067912+00
re-1782082014213-ffe4763c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:54.213532+00
re-1782082021344-4418b24b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:01.343487+00
re-1782082031521-fecfb635	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:11.521876+00
re-1782082038525-16e4d500	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:18.524512+00
re-1782082045537-4e490335	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:25.537298+00
re-1782082052634-7613739c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:32.634123+00
re-1782082059616-be198226	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:39.61591+00
re-1782082066658-0263ee67	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:46.658349+00
re-1782082073734-b2191bc2	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:53.734833+00
re-1782082080700-cc952e8e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:00.700545+00
re-1782082087619-2e21b439	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:07.619688+00
re-1782082094718-8e6ec6ee	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:14.717846+00
re-1782082101737-93249c0d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:21.736961+00
re-1782082108727-f00b548b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:28.727419+00
re-1782082115813-6d09ef8e	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:35.813396+00
re-1782082122853-05d8e481	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:42.853175+00
re-1782082129860-98bb63cc	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:49.860127+00
re-1782082136862-b65a0187	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:56.862263+00
re-1782082144186-874eeb8b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:04.185766+00
re-1782082151225-92593622	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:11.224745+00
re-1782082158280-9835e161	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:18.279935+00
re-1782082165381-801676c0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:25.380741+00
re-1782082172385-85dcb662	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:32.38555+00
re-1782082179353-a5819474	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:39.353623+00
re-1782082186307-0d9e4668	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:46.307152+00
re-1782082193246-9b0e1232	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:53.246705+00
re-1782082200196-df57bce1	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:00.196366+00
re-1782082207325-60fd5259	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:07.325201+00
re-1782081952979-47583fb4	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:45:52.978873+00
re-1782081960085-e1148623	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:00.085439+00
re-1782081967158-93cb91f7	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:07.158499+00
re-1782081974220-13ec92a0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:14.22059+00
re-1782081981275-f0660b49	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:21.274707+00
re-1782081988257-f20df02d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:28.257383+00
re-1782081995257-2bebb4e9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:35.256865+00
re-1782082002337-0988af78	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:42.337531+00
re-1782082009413-390d3b46	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:49.413512+00
re-1782082016671-697251cf	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:46:56.671384+00
re-1782082023713-1f061993	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:03.712992+00
re-1782082029197-f979e787	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:09.19526+00
re-1782082036206-6775eba6	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:16.206524+00
re-1782082043227-238b93da	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:23.227163+00
re-1782082050235-b2635d46	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:30.235431+00
re-1782082057297-9ce88ad9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:37.296867+00
re-1782082064298-f0d5dd0c	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:44.298624+00
re-1782082071357-c907d68f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:51.357493+00
re-1782082078390-34f26b66	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:47:58.389775+00
re-1782082085308-f6d1b84d	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:05.3081+00
re-1782082092382-f7e0a371	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:12.381608+00
re-1782082099428-740c7904	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:19.428417+00
re-1782082106375-5b0f519a	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:26.375021+00
re-1782082113426-157687a9	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:33.426347+00
re-1782082120519-3a203e40	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:40.519237+00
re-1782082127542-b9f246b0	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:47.542712+00
re-1782082134545-27c50555	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:48:54.545621+00
re-1782082141742-5fea11d5	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:01.742299+00
re-1782082148883-2853d542	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:08.882832+00
re-1782082155950-4913110f	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:15.950335+00
re-1782082162934-65f21e93	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:22.93407+00
re-1782082170056-e3f41158	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:30.056322+00
re-1782082177022-5a835846	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:37.021902+00
re-1782082183985-88321d93	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:43.984734+00
re-1782082190931-7fbf7196	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:50.930769+00
re-1782082197872-9f7f6051	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:49:57.872091+00
re-1782082204951-b348033b	reel-1781870490939-bd73f2f5	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	watch	{"signal": "watch"}	2026-06-21 22:50:04.95084+00
\.


--
-- Data for Name: lajukan_reel_user_actions; Type: TABLE DATA; Schema: forum; Owner: app
--

COPY forum.lajukan_reel_user_actions (id, reel_id, actor_user_id, target_user_id, action, created_at, updated_at) FROM stdin;
ra-1781813401460-f75dcefa	reel-1781813353455-21328074	auth-3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	\N	like	2026-06-18 20:10:01.460222+00	2026-06-18 20:10:01.460222+00
ra-1781827342052-480fa724	reel-1781813353455-21328074	auth-1747f31a-2972-4506-b997-1c03eb38aa6e	\N	like	2026-06-19 00:02:22.051966+00	2026-06-19 00:02:22.051966+00
\.


--
-- Data for Name: lajukan_reel_comments; Type: TABLE DATA; Schema: reel; Owner: app
--

COPY reel.lajukan_reel_comments (id, reel_id, author_user_id, author_name, author_avatar_url, body, status, created_at, updated_at, parent_comment_id, reply_count, author_avatar) FROM stdin;
rc-1781872248281-2a473b64	reel-1781813353455-21328074	auth-11111111-1111-1111-1111-111111111111	Codex	/default-avatar.svg	mantapp	published	2026-06-19 12:30:48.284039+00	2026-06-19 12:30:48.284039+00	\N	0	/default-avatar.svg
rc-1781879420129-81ecb2d3	reel-1781813353455-21328074	auth-user-123	user@example.com	/default-avatar.svg	final-db-check	published	2026-06-19 14:30:20.130904+00	2026-06-19 14:30:20.130904+00	\N	0	\N
\.


--
-- Data for Name: lajukan_reels; Type: TABLE DATA; Schema: reel; Owner: app
--

COPY reel.lajukan_reels (id, creator_user_id, creator, title, caption, tag, product_name, product_price, product_href, video_src, source_url, likes_count, comments_count, shares_count, tone, icon_key, media_url, media_type, hook, store_id, store_slug, store_name, store_city, store_phone, storefront_path, status, published_at, created_at, updated_at, filter_preset, capture_mode, live_status, live_title, live_scheduled_at, metadata) FROM stdin;
reel-1781870490939-bd73f2f5	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	Fauzan Yanuarp	WhatsApp Video 2026 06 18 at 10.35.04 AM	WhatsApp Video 2026 06 18 at 10.35.04 AM	UMKM	\N	\N	\N	/uploads/forum/1781870484051-242417b2-8eb0-4587-8ccc-ffacb2491d42-WhatsApp_Video_2026-06-18_at_10.35.04_AM.mp4	/uploads/forum/1781870484051-242417b2-8eb0-4587-8ccc-ffacb2491d42-WhatsApp_Video_2026-06-18_at_10.35.04_AM.mp4	0	0	0	emerald	marketing	/uploads/forum/1781870484051-242417b2-8eb0-4587-8ccc-ffacb2491d42-WhatsApp_Video_2026-06-18_at_10.35.04_AM.mp4	video	WhatsApp Video 2026 06 18 at 10.35.04 AM	store-fauzan-yanuarp	fauzan-yanuarp	Fauzan Yanuarp		\N	/toko/fauzan-yanuarp	published	2026-06-19 12:01:30.952022+00	2026-06-19 12:01:30.952022+00	2026-06-19 12:01:30.952022+00	natural	upload	none	\N	\N	{"studio": {"live": false, "mode": "gallery", "speed": "1x", "effect": "none", "duration": "15s", "musicTrack": "Original sound", "captureMode": "upload", "filterPreset": "natural"}, "studioEffect": "none"}
reel-1781813353455-21328074	3af4e0fd-ec84-4177-9b50-b43dd6d9c9b5	Fauzan Yanuarp	WhatsApp Video 2026 06 18 at 10.35.04 AM	WhatsApp Video 2026 06 18 at 10.35.04 AM	UMKM	\N	\N	\N	/api/content/media/laju-chat/forum/85660ff8-1dab-4fc7-9401-e9981b6177a0.mp4	/api/content/media/laju-chat/forum/85660ff8-1dab-4fc7-9401-e9981b6177a0.mp4	2	2	1	emerald	marketing	/api/content/media/laju-chat/forum/85660ff8-1dab-4fc7-9401-e9981b6177a0.mp4	video	WhatsApp Video 2026 06 18 at 10.35.04 AM	store-fauzan-yanuarp	fauzan-yanuarp	Fauzan Yanuarp		\N	/toko/fauzan-yanuarp	published	2026-06-18 20:09:13.457835+00	2026-06-18 20:09:13.457835+00	2026-06-19 14:30:20.130904+00	natural	upload	none	\N	\N	{"studio": {"live": false, "mode": "gallery", "speed": "1x", "effect": "none", "duration": "15s", "musicTrack": "Original sound", "captureMode": "upload", "filterPreset": "natural"}, "studioEffect": "none"}
\.


--
-- Name: event_inbox event_inbox_pkey; Type: CONSTRAINT; Schema: events; Owner: app
--

ALTER TABLE ONLY events.event_inbox
    ADD CONSTRAINT event_inbox_pkey PRIMARY KEY (id);


--
-- Name: event_inbox event_inbox_source_event_id_key; Type: CONSTRAINT; Schema: events; Owner: app
--

ALTER TABLE ONLY events.event_inbox
    ADD CONSTRAINT event_inbox_source_event_id_key UNIQUE (source, event_id);


--
-- Name: event_outbox event_outbox_pkey; Type: CONSTRAINT; Schema: events; Owner: app
--

ALTER TABLE ONLY events.event_outbox
    ADD CONSTRAINT event_outbox_pkey PRIMARY KEY (id);


--
-- Name: _sqlx_migrations _sqlx_migrations_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);


--
-- Name: lajukan_forum_audit_logs lajukan_forum_audit_logs_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_audit_logs
    ADD CONSTRAINT lajukan_forum_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: lajukan_forum_categories lajukan_forum_categories_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_categories
    ADD CONSTRAINT lajukan_forum_categories_pkey PRIMARY KEY (id);


--
-- Name: lajukan_forum_categories lajukan_forum_categories_slug_key; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_categories
    ADD CONSTRAINT lajukan_forum_categories_slug_key UNIQUE (slug);


--
-- Name: lajukan_forum_posts lajukan_forum_posts_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_posts
    ADD CONSTRAINT lajukan_forum_posts_pkey PRIMARY KEY (id);


--
-- Name: lajukan_forum_tags lajukan_forum_tags_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_tags
    ADD CONSTRAINT lajukan_forum_tags_pkey PRIMARY KEY (id);


--
-- Name: lajukan_forum_tags lajukan_forum_tags_slug_key; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_tags
    ADD CONSTRAINT lajukan_forum_tags_slug_key UNIQUE (slug);


--
-- Name: lajukan_forum_thread_tags lajukan_forum_thread_tags_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_thread_tags
    ADD CONSTRAINT lajukan_forum_thread_tags_pkey PRIMARY KEY (thread_id, tag_slug);


--
-- Name: lajukan_forum_threads lajukan_forum_threads_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_threads
    ADD CONSTRAINT lajukan_forum_threads_pkey PRIMARY KEY (id);


--
-- Name: lajukan_forum_users lajukan_forum_users_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_users
    ADD CONSTRAINT lajukan_forum_users_pkey PRIMARY KEY (id);


--
-- Name: lajukan_forum_users lajukan_forum_users_username_key; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_users
    ADD CONSTRAINT lajukan_forum_users_username_key UNIQUE (username);


--
-- Name: lajukan_forum_votes lajukan_forum_votes_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_votes
    ADD CONSTRAINT lajukan_forum_votes_pkey PRIMARY KEY (id);


--
-- Name: lajukan_forum_votes lajukan_forum_votes_target_type_target_id_user_id_key; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_votes
    ADD CONSTRAINT lajukan_forum_votes_target_type_target_id_user_id_key UNIQUE (target_type, target_id, user_id);


--
-- Name: lajukan_group_members lajukan_group_members_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_group_members
    ADD CONSTRAINT lajukan_group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: lajukan_groups lajukan_groups_category_id_key; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_groups
    ADD CONSTRAINT lajukan_groups_category_id_key UNIQUE (category_id);


--
-- Name: lajukan_groups lajukan_groups_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_groups
    ADD CONSTRAINT lajukan_groups_pkey PRIMARY KEY (id);


--
-- Name: lajukan_groups lajukan_groups_slug_key; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_groups
    ADD CONSTRAINT lajukan_groups_slug_key UNIQUE (slug);


--
-- Name: lajukan_reel_events lajukan_reel_events_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_reel_events
    ADD CONSTRAINT lajukan_reel_events_pkey PRIMARY KEY (id);


--
-- Name: lajukan_reel_user_actions lajukan_reel_user_actions_pkey; Type: CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_reel_user_actions
    ADD CONSTRAINT lajukan_reel_user_actions_pkey PRIMARY KEY (id);


--
-- Name: lajukan_reel_comments lajukan_reel_comments_pkey; Type: CONSTRAINT; Schema: reel; Owner: app
--

ALTER TABLE ONLY reel.lajukan_reel_comments
    ADD CONSTRAINT lajukan_reel_comments_pkey PRIMARY KEY (id);


--
-- Name: lajukan_reels lajukan_reels_pkey; Type: CONSTRAINT; Schema: reel; Owner: app
--

ALTER TABLE ONLY reel.lajukan_reels
    ADD CONSTRAINT lajukan_reels_pkey PRIMARY KEY (id);


--
-- Name: idx_community_event_inbox_pending; Type: INDEX; Schema: events; Owner: app
--

CREATE INDEX idx_community_event_inbox_pending ON events.event_inbox USING btree (status, available_at, received_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: idx_community_event_outbox_pending; Type: INDEX; Schema: events; Owner: app
--

CREATE INDEX idx_community_event_outbox_pending ON events.event_outbox USING btree (status, available_at, created_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: lajukan_forum_audit_logs_target_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_audit_logs_target_idx ON forum.lajukan_forum_audit_logs USING btree (target_type, target_id, created_at DESC);


--
-- Name: lajukan_forum_categories_position_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_categories_position_idx ON forum.lajukan_forum_categories USING btree ("position", name);


--
-- Name: lajukan_forum_posts_parent_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_posts_parent_idx ON forum.lajukan_forum_posts USING btree (reply_to_post_id);


--
-- Name: lajukan_forum_posts_search_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_posts_search_idx ON forum.lajukan_forum_posts USING gin (to_tsvector('simple'::regconfig, COALESCE(content, ''::text)));


--
-- Name: lajukan_forum_posts_thread_created_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_posts_thread_created_idx ON forum.lajukan_forum_posts USING btree (thread_id, created_at);


--
-- Name: lajukan_forum_tags_usage_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_tags_usage_idx ON forum.lajukan_forum_tags USING btree (usage_count DESC, name);


--
-- Name: lajukan_forum_thread_tags_tag_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_thread_tags_tag_idx ON forum.lajukan_forum_thread_tags USING btree (tag_slug, thread_id);


--
-- Name: lajukan_forum_threads_category_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_threads_category_idx ON forum.lajukan_forum_threads USING btree (category_id, last_activity_at DESC);


--
-- Name: lajukan_forum_threads_feed_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_threads_feed_idx ON forum.lajukan_forum_threads USING btree (last_activity_at DESC, created_at DESC);


--
-- Name: lajukan_forum_threads_group_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_threads_group_idx ON forum.lajukan_forum_threads USING btree (group_id, last_activity_at DESC);


--
-- Name: lajukan_forum_threads_search_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_threads_search_idx ON forum.lajukan_forum_threads USING gin (to_tsvector('simple'::regconfig, ((COALESCE(title, ''::text) || ' '::text) || COALESCE(slug, ''::text))));


--
-- Name: lajukan_forum_users_reputation_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_users_reputation_idx ON forum.lajukan_forum_users USING btree (reputation DESC, updated_at DESC);


--
-- Name: lajukan_forum_users_search_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_users_search_idx ON forum.lajukan_forum_users USING gin (to_tsvector('simple'::regconfig, ((((COALESCE(username, ''::text) || ' '::text) || COALESCE(name, ''::text)) || ' '::text) || COALESCE(title, ''::text))));


--
-- Name: lajukan_forum_votes_target_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_forum_votes_target_idx ON forum.lajukan_forum_votes USING btree (target_type, target_id);


--
-- Name: lajukan_group_members_user_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_group_members_user_idx ON forum.lajukan_group_members USING btree (user_id, status, updated_at DESC);


--
-- Name: lajukan_groups_discovery_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_groups_discovery_idx ON forum.lajukan_groups USING btree (status, privacy, updated_at DESC);


--
-- Name: lajukan_groups_search_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_groups_search_idx ON forum.lajukan_groups USING gin (to_tsvector('simple'::regconfig, ((((COALESCE(name, ''::text) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(slug, ''::text))));


--
-- Name: lajukan_reel_events_actor_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_reel_events_actor_idx ON forum.lajukan_reel_events USING btree (actor_user_id, created_at DESC);


--
-- Name: lajukan_reel_events_reel_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_reel_events_reel_idx ON forum.lajukan_reel_events USING btree (reel_id, event_type, created_at DESC);


--
-- Name: lajukan_reel_user_actions_actor_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE INDEX lajukan_reel_user_actions_actor_idx ON forum.lajukan_reel_user_actions USING btree (actor_user_id, action, updated_at DESC);


--
-- Name: lajukan_reel_user_actions_unique_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE UNIQUE INDEX lajukan_reel_user_actions_unique_idx ON forum.lajukan_reel_user_actions USING btree (reel_id, actor_user_id, action);


--
-- Name: lajukan_reel_user_follows_unique_idx; Type: INDEX; Schema: forum; Owner: app
--

CREATE UNIQUE INDEX lajukan_reel_user_follows_unique_idx ON forum.lajukan_reel_user_actions USING btree (actor_user_id, target_user_id, action) WHERE ((action = 'follow'::text) AND (target_user_id IS NOT NULL));


--
-- Name: lajukan_reel_comments_author_idx; Type: INDEX; Schema: reel; Owner: app
--

CREATE INDEX lajukan_reel_comments_author_idx ON reel.lajukan_reel_comments USING btree (author_user_id, created_at DESC);


--
-- Name: lajukan_reel_comments_body_search_idx; Type: INDEX; Schema: reel; Owner: app
--

CREATE INDEX lajukan_reel_comments_body_search_idx ON reel.lajukan_reel_comments USING gin (to_tsvector('simple'::regconfig, COALESCE(body, ''::text)));


--
-- Name: lajukan_reel_comments_parent_idx; Type: INDEX; Schema: reel; Owner: app
--

CREATE INDEX lajukan_reel_comments_parent_idx ON reel.lajukan_reel_comments USING btree (reel_id, parent_comment_id, status, created_at, id);


--
-- Name: lajukan_reel_comments_reel_idx; Type: INDEX; Schema: reel; Owner: app
--

CREATE INDEX lajukan_reel_comments_reel_idx ON reel.lajukan_reel_comments USING btree (reel_id, status, created_at DESC, id DESC);


--
-- Name: lajukan_reels_feed_idx; Type: INDEX; Schema: reel; Owner: app
--

CREATE INDEX lajukan_reels_feed_idx ON reel.lajukan_reels USING btree (status, published_at DESC, id);


--
-- Name: lajukan_reels_search_idx; Type: INDEX; Schema: reel; Owner: app
--

CREATE INDEX lajukan_reels_search_idx ON reel.lajukan_reels USING gin (to_tsvector('simple'::regconfig, ((((((((((((COALESCE(title, ''::text) || ' '::text) || COALESCE(caption, ''::text)) || ' '::text) || COALESCE(creator, ''::text)) || ' '::text) || COALESCE(tag, ''::text)) || ' '::text) || COALESCE(product_name, ''::text)) || ' '::text) || COALESCE(store_name, ''::text)) || ' '::text) || COALESCE(store_city, ''::text))));


--
-- Name: lajukan_reels_store_idx; Type: INDEX; Schema: reel; Owner: app
--

CREATE INDEX lajukan_reels_store_idx ON reel.lajukan_reels USING btree (store_slug, store_city, status);


--
-- Name: lajukan_forum_posts lajukan_forum_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_posts
    ADD CONSTRAINT lajukan_forum_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES forum.lajukan_forum_users(id);


--
-- Name: lajukan_forum_posts lajukan_forum_posts_thread_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_posts
    ADD CONSTRAINT lajukan_forum_posts_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES forum.lajukan_forum_threads(id) ON DELETE CASCADE;


--
-- Name: lajukan_forum_thread_tags lajukan_forum_thread_tags_tag_slug_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_thread_tags
    ADD CONSTRAINT lajukan_forum_thread_tags_tag_slug_fkey FOREIGN KEY (tag_slug) REFERENCES forum.lajukan_forum_tags(slug) ON DELETE CASCADE;


--
-- Name: lajukan_forum_thread_tags lajukan_forum_thread_tags_thread_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_thread_tags
    ADD CONSTRAINT lajukan_forum_thread_tags_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES forum.lajukan_forum_threads(id) ON DELETE CASCADE;


--
-- Name: lajukan_forum_threads lajukan_forum_threads_author_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_threads
    ADD CONSTRAINT lajukan_forum_threads_author_id_fkey FOREIGN KEY (author_id) REFERENCES forum.lajukan_forum_users(id);


--
-- Name: lajukan_forum_threads lajukan_forum_threads_category_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_threads
    ADD CONSTRAINT lajukan_forum_threads_category_id_fkey FOREIGN KEY (category_id) REFERENCES forum.lajukan_forum_categories(id);


--
-- Name: lajukan_forum_threads lajukan_forum_threads_group_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_threads
    ADD CONSTRAINT lajukan_forum_threads_group_id_fkey FOREIGN KEY (group_id) REFERENCES forum.lajukan_groups(id) ON DELETE SET NULL;


--
-- Name: lajukan_forum_votes lajukan_forum_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_forum_votes
    ADD CONSTRAINT lajukan_forum_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE;


--
-- Name: lajukan_group_members lajukan_group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_group_members
    ADD CONSTRAINT lajukan_group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES forum.lajukan_groups(id) ON DELETE CASCADE;


--
-- Name: lajukan_group_members lajukan_group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_group_members
    ADD CONSTRAINT lajukan_group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE;


--
-- Name: lajukan_groups lajukan_groups_category_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_groups
    ADD CONSTRAINT lajukan_groups_category_id_fkey FOREIGN KEY (category_id) REFERENCES forum.lajukan_forum_categories(id) ON DELETE CASCADE;


--
-- Name: lajukan_groups lajukan_groups_created_by_user_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_groups
    ADD CONSTRAINT lajukan_groups_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES forum.lajukan_forum_users(id) ON DELETE SET NULL;


--
-- Name: lajukan_reel_events lajukan_reel_events_reel_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_reel_events
    ADD CONSTRAINT lajukan_reel_events_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE;


--
-- Name: lajukan_reel_user_actions lajukan_reel_user_actions_actor_user_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_reel_user_actions
    ADD CONSTRAINT lajukan_reel_user_actions_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE;


--
-- Name: lajukan_reel_user_actions lajukan_reel_user_actions_reel_id_fkey; Type: FK CONSTRAINT; Schema: forum; Owner: app
--

ALTER TABLE ONLY forum.lajukan_reel_user_actions
    ADD CONSTRAINT lajukan_reel_user_actions_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE;


--
-- Name: lajukan_reel_comments lajukan_reel_comments_author_user_id_fkey; Type: FK CONSTRAINT; Schema: reel; Owner: app
--

ALTER TABLE ONLY reel.lajukan_reel_comments
    ADD CONSTRAINT lajukan_reel_comments_author_user_id_fkey FOREIGN KEY (author_user_id) REFERENCES forum.lajukan_forum_users(id) ON DELETE CASCADE;


--
-- Name: lajukan_reel_comments lajukan_reel_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: reel; Owner: app
--

ALTER TABLE ONLY reel.lajukan_reel_comments
    ADD CONSTRAINT lajukan_reel_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES reel.lajukan_reel_comments(id) ON DELETE CASCADE;


--
-- Name: lajukan_reel_comments lajukan_reel_comments_reel_id_fkey; Type: FK CONSTRAINT; Schema: reel; Owner: app
--

ALTER TABLE ONLY reel.lajukan_reel_comments
    ADD CONSTRAINT lajukan_reel_comments_reel_id_fkey FOREIGN KEY (reel_id) REFERENCES reel.lajukan_reels(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict X7DRhvzExAbDMkhG9f5GHGZT1hhpQyJqTpwlcA8DpgZZ4qVElNKaepmE2vC123d

