USE laju_chat;

-- Additive trust-and-safety storage. Apply before deploying application code
-- that exposes /blocks or /reports and before enabling block enforcement.
CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id uuid,
    blocked_id uuid,
    created_at timestamp,
    PRIMARY KEY ((blocker_id), blocked_id)
)
WITH compression = {'sstable_compression': 'LZ4Compressor'};

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
