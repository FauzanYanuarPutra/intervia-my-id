ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS support_room_id TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_support_room_id
  ON support_tickets(support_room_id);
