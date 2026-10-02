-- Persist the latest room read time so the UI can render WhatsApp-style
-- single/double check states without scanning every message receipt.
ALTER TABLE user_room_state ADD last_read_at timestamp;
