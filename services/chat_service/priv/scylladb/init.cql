-- ============================================================
-- LAJU CHAT DATABASE (SCYLLA / CASSANDRA)
-- FINAL · CLEAN · HIGH PERFORMANCE
-- ============================================================

CREATE KEYSPACE IF NOT EXISTS laju_chat
WITH replication = {
  'class': 'SimpleStrategy',
  'replication_factor': 3
}
AND durable_writes = true;

USE laju_chat;

-- ============================================================
-- 1. USER PROJECTION (FROM IDENTITY SERVICE)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    user_id uuid PRIMARY KEY,
    username text,
    display_name text,
    avatar_url text,
    status_message text,
    last_active timestamp,
    updated_at timestamp
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- ============================================================
-- 2. PRESENCE (EPHEMERAL, TTL-BASED)
-- ============================================================
CREATE TABLE IF NOT EXISTS presence (
    user_id uuid PRIMARY KEY,
    is_online boolean,
    last_seen timestamp
)
WITH default_time_to_live = 60;

-- ============================================================
-- 3. ROOMS (DM / GROUP / BUSINESS)
-- ============================================================
CREATE TABLE IF NOT EXISTS rooms (
    room_id text PRIMARY KEY,
    room_type text,          -- dm | group | business
    room_name text,
    room_avatar text,
    created_by uuid,
    created_at timestamp,
    metadata map<text, text>
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- ============================================================
-- 4. ROOM MEMBERS (AUTHORIZATION SOURCE)
-- ============================================================
CREATE TABLE IF NOT EXISTS room_members (
    room_id text,
    user_id uuid,
    role text,               -- owner | admin | member
    joined_at timestamp,
    PRIMARY KEY (room_id, user_id)
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- ============================================================
-- 5. USER INBOX (SIDEBAR)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_rooms (
    user_id uuid,
    last_message_at timestamp,
    room_id text,
    room_type text,
    room_name text,
    room_avatar text,
    last_message text,
    last_sender uuid,
    unread_count int,
    is_pinned boolean,
    PRIMARY KEY (user_id, last_message_at, room_id)
)
WITH CLUSTERING ORDER BY (last_message_at DESC)
AND compression = {'sstable_compression': 'LZ4Compressor'};

-- Canonical inbox projection. The legacy user_rooms table above is retained
-- temporarily so rolling deployments can merge old rows while this table is
-- backfilled. One partition row per room prevents unbounded duplicate inbox
-- entries for every message.
CREATE TABLE IF NOT EXISTS user_room_state (
    user_id uuid,
    room_id text,
    last_message_at timestamp,
    room_type text,
    room_name text,
    room_avatar text,
    last_message text,
    last_sender uuid,
    unread_count int,
    is_pinned boolean,
    PRIMARY KEY ((user_id), room_id)
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- ============================================================
-- 6. MESSAGES (BUCKETED)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    room_id text,
    bucket int,               -- YYYYMM
    message_id timeuuid,
    sender_id uuid,
    content text,
    message_type text,        -- text | image | file | system
    attachments list<text>,
    is_edited boolean,
    is_deleted boolean,
    sent_at timestamp,
    PRIMARY KEY ((room_id, bucket), message_id)
)
WITH CLUSTERING ORDER BY (message_id DESC)
AND compaction = {
  'class': 'TimeWindowCompactionStrategy',
  'compaction_window_size': 1,
  'compaction_window_unit': 'DAYS'
}
AND compression = {'sstable_compression': 'LZ4Compressor'};

-- Stable idempotency reservation used by both websocket and HTTP sends.
-- Every client ref is its own partition so high-volume rooms do not create an
-- unbounded deduplication partition or serialize unrelated LWT operations.
CREATE TABLE IF NOT EXISTS message_client_refs (
    room_id text,
    sender_id uuid,
    client_ref text,
    message_id timeuuid,
    bucket int,
    sent_at timestamp,
    payload_hash text,
    created_at timestamp,
    PRIMARY KEY ((room_id, sender_id, client_ref))
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- ============================================================
-- 7. READ RECEIPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reads (
    room_id text,
    message_id timeuuid,
    user_id uuid,
    read_at timestamp,
    PRIMARY KEY ((room_id, message_id), user_id)
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- ============================================================
-- 8. UNREAD COUNTERS (FAST BADGES)
-- ============================================================
CREATE TABLE IF NOT EXISTS unread_counters (
    user_id uuid,
    room_id text,
    unread counter,
    PRIMARY KEY (user_id, room_id)
);

-- ============================================================
-- 9. CHAT TRUST AND SAFETY
-- ============================================================
-- Directional block rows keep the user's own block list queryable. Message
-- send checks both directions for deterministic DM rooms.
CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id uuid,
    blocked_id uuid,
    created_at timestamp,
    PRIMARY KEY ((blocker_id), blocked_id)
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- Append-only report intake. Each report has its own bounded partition and a
-- stable timeuuid; moderation projections can be added separately when an ops
-- query contract is approved instead of relying on ALLOW FILTERING.
CREATE TABLE IF NOT EXISTS chat_reports (
    report_id timeuuid,
    reporter_id uuid,
    room_id text,
    message_id timeuuid,
    reported_user_id uuid,
    reason text,
    details text,
    created_at timestamp,
    status text,
    PRIMARY KEY ((report_id))
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

-- ============================================================
-- END — THIS IS ENOUGH FOR 10M+ USERS
-- ============================================================

