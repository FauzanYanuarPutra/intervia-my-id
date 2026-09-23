-- Persist WhatsApp-style reply/quote metadata on chat messages.
-- The reference points back to the original message in the same room and
-- carries a compact snapshot so history remains renderable after refresh.
ALTER TABLE messages ADD reply_to_message_id text;
ALTER TABLE messages ADD reply_mode text;
ALTER TABLE messages ADD reply_to_sender_id uuid;
ALTER TABLE messages ADD reply_to_sender_name text;
ALTER TABLE messages ADD reply_to_content text;
ALTER TABLE messages ADD reply_to_message_type text;
ALTER TABLE messages ADD reply_to_attachments list<text>;
ALTER TABLE messages ADD reply_to_created_at timestamp;
