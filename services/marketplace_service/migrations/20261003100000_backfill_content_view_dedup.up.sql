-- Backfill the deduplicated listing-view ledger from the event stream.
-- Only public content views are counted; an owner's own view is excluded.
INSERT INTO events.content_view_dedup (
    entity_type,
    entity_id,
    viewer_key,
    view_date,
    first_seen_at
)
SELECT
    'content',
    ev.entity_id,
    CASE
        WHEN ev.actor_user_id IS NOT NULL
            THEN 'user:' || ev.actor_user_id::text
        WHEN NULLIF(BTRIM(ev.anonymous_id), '') IS NOT NULL
            THEN 'anonymous:' || BTRIM(ev.anonymous_id)
        WHEN NULLIF(BTRIM(ev.session_id), '') IS NOT NULL
            THEN 'session:' || BTRIM(ev.session_id)
        WHEN NULLIF(BTRIM(ev.context->>'ip_hash'), '') IS NOT NULL
            THEN 'ip:' || BTRIM(ev.context->>'ip_hash')
        ELSE NULL
    END AS viewer_key,
    (ev.occurred_at AT TIME ZONE 'UTC')::date AS view_date,
    MIN(ev.occurred_at) AS first_seen_at
FROM events.event_log ev
JOIN content_items ci
  ON ci.id::text = ev.entity_id
WHERE ev.event_name = 'content.viewed'
  AND lower(COALESCE(ev.entity_type, '')) = 'content'
  AND ci.content_status = 'active'
  AND (ev.actor_user_id IS NULL OR ev.actor_user_id <> ci.owner_id)
  AND (
      ev.actor_user_id IS NOT NULL
      OR NULLIF(BTRIM(ev.anonymous_id), '') IS NOT NULL
      OR NULLIF(BTRIM(ev.session_id), '') IS NOT NULL
      OR NULLIF(BTRIM(ev.context->>'ip_hash'), '') IS NOT NULL
  )
GROUP BY
    ev.entity_id,
    CASE
        WHEN ev.actor_user_id IS NOT NULL
            THEN 'user:' || ev.actor_user_id::text
        WHEN NULLIF(BTRIM(ev.anonymous_id), '') IS NOT NULL
            THEN 'anonymous:' || BTRIM(ev.anonymous_id)
        WHEN NULLIF(BTRIM(ev.session_id), '') IS NOT NULL
            THEN 'session:' || BTRIM(ev.session_id)
        WHEN NULLIF(BTRIM(ev.context->>'ip_hash'), '') IS NOT NULL
            THEN 'ip:' || BTRIM(ev.context->>'ip_hash')
        ELSE NULL
    END,
    (ev.occurred_at AT TIME ZONE 'UTC')::date
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_event_log_content_view_lookup
  ON events.event_log (entity_type, entity_id, event_name, occurred_at)
  WHERE event_name = 'content.viewed';
