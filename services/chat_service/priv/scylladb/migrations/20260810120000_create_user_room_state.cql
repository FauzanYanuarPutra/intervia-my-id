USE laju_chat;

-- Additive replacement for user_rooms. The old table clusters by message
-- timestamp, so every message creates another inbox row. This projection has
-- exactly one current-state row per user and room.
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
