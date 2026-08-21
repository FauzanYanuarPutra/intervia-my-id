USE laju_chat;

-- Deploy this table before application instances that reserve client refs.
-- One partition per logical send keeps LWT contention scoped to retries of the
-- same message and avoids an ever-growing room/sender partition.
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
