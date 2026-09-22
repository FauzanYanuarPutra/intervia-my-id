CREATE TABLE IF NOT EXISTS call_records_by_id (
  call_id uuid PRIMARY KEY,
  room_id text,
  caller_id uuid,
  callee_id uuid,
  call_type text,
  bucket int,
  started_at timestamp,
  status text,
  connected_at timestamp,
  ended_at timestamp,
  duration_seconds int,
  end_reason text
);

CREATE TABLE IF NOT EXISTS call_history_by_user (
  user_id uuid,
  bucket int,
  call_id uuid,
  room_id text,
  peer_user_id uuid,
  caller_user_id uuid,
  call_type text,
  status text,
  started_at timestamp,
  connected_at timestamp,
  ended_at timestamp,
  duration_seconds int,
  end_reason text,
  PRIMARY KEY ((user_id, bucket), call_id)
);