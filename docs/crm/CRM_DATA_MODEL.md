# CRM Data Model

Status: proposed additive model 2026-07-11.

## Current Schema

Existing CRM schema is small:

| Table | Role |
| --- | --- |
| `crm_leads` | lead/opportunity-like records with requester, owner, contact, content, chat room, stage, source, value, metadata |
| `crm_activities` | timeline attached to a lead |

Existing marketplace/request data:

| Table/Entity | Role |
| --- | --- |
| `content_items` | listings and requests |
| `content_items.pricing_mode = 'request'` | kebutuhan/request-like content |
| `support_tickets` | reports/help/disputes |
| `events.event_log` | product analytics/events |

## Modeling Decision

Do not duplicate all kebutuhan/listing data into CRM tables.

Use marketplace entities as source records:

- requirement source: `content_items` request when available;
- provider source: `content_items`, UMKM stores/products, and related trust profile data;
- support source: support ticket ID;
- chat source: chat room/conversation ID.

CRM matching tables store review, extraction, candidate scoring, connection, feedback, and audit.

## Proposed Additive Tables

### `crm_requirement_reviews`

Tracks CRM review state for a kebutuhan/request without replacing `content_items`.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `source_type` | text | `content_item`, `chat`, `support_ticket`, `manual` |
| `source_id` | uuid/text | Source identifier |
| `requester_user_id` | uuid nullable | |
| `status` | text | new, needs_review, ready_to_match, matching, connected, closed, invalid |
| `priority` | text | low, normal, high, urgent |
| `assigned_to` | uuid nullable | admin/ops user |
| `original_text_snapshot` | text nullable | snapshot for audit; do not mutate |
| `original_metadata_snapshot` | jsonb | snapshot |
| `admin_summary` | text nullable | admin-curated short summary |
| `risk_flags` | jsonb | array/object |
| `created_by` | uuid nullable | |
| `created_at`, `updated_at` | timestamptz | |

Indexes:

- `(status, updated_at desc)`;
- `(assigned_to, status)`;
- `(source_type, source_id)` unique where possible.

### `crm_requirement_extractions`

Stores AI/rule extraction attempts and admin corrections.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `requirement_review_id` | uuid FK | |
| `source_type` | text | `ai`, `rule`, `admin_correction` |
| `model_provider` | text nullable | `ollama`, `groq`, `safe-fallback`, etc |
| `model_name` | text nullable | |
| `prompt_version` | text nullable | |
| `schema_version` | text not null | |
| `extracted_data` | jsonb not null | schema-validated |
| `confidence` | numeric | 0..1 |
| `missing_fields` | jsonb | |
| `warnings` | jsonb | |
| `created_by` | uuid nullable | admin/user/system |
| `created_at` | timestamptz | |

Indexes:

- `(requirement_review_id, created_at desc)`;
- `(schema_version)`;
- GIN on `extracted_data` if queried.

### `crm_matching_weight_versions`

Versioned scoring config.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `version_key` | text unique | e.g. `lajukan-match-score-v1` |
| `weights` | jsonb | component weights |
| `policy_notes` | text | |
| `active` | boolean | only one active per target if enforced |
| `created_by` | uuid nullable | |
| `created_at` | timestamptz | |

### `crm_matching_runs`

One run per matching attempt.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `requirement_review_id` | uuid FK | |
| `extraction_id` | uuid nullable FK | |
| `status` | text | queued, extracted, retrieved, scored, needs_admin_review, approved, connected, no_match, failed |
| `scoring_version` | text | |
| `retrieval_strategy` | text | postgres, meili, hybrid |
| `candidate_count` | integer | |
| `top_score` | numeric | |
| `error_code` | text nullable | |
| `error_message_internal` | text nullable | internal only |
| `idempotency_key` | text nullable unique | |
| `started_at`, `completed_at` | timestamptz nullable | |
| `created_by` | uuid nullable | |
| `created_at` | timestamptz | |

Indexes:

- `(requirement_review_id, created_at desc)`;
- `(status, created_at desc)`;
- unique `(idempotency_key)` where not null.

### `crm_matching_candidates`

Candidate provider/listing result.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `matching_run_id` | uuid FK | |
| `candidate_type` | text | content_item, umkm_store, umkm_product, business_profile |
| `candidate_id` | uuid/text | |
| `provider_user_id` | uuid nullable | |
| `provider_business_id` | uuid nullable | |
| `rank` | integer | |
| `score_total` | numeric | 0..100 |
| `score_breakdown` | jsonb | |
| `matched_fields` | jsonb | |
| `missing_fields` | jsonb | |
| `reasons` | jsonb | |
| `warnings` | jsonb | |
| `verification_snapshot` | jsonb | |
| `location_snapshot` | jsonb | |
| `admin_status` | text | pending, approved, rejected, held |
| `admin_reason` | text nullable | |
| `reviewed_by` | uuid nullable | |
| `reviewed_at` | timestamptz nullable | |
| `created_at` | timestamptz | |

Indexes:

- `(matching_run_id, rank)`;
- `(candidate_type, candidate_id)`;
- `(admin_status, created_at desc)`.

### `crm_connections`

Represents the actual handoff between pencari and penyedia.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `requirement_review_id` | uuid FK | |
| `matching_run_id` | uuid nullable FK | |
| `matching_candidate_id` | uuid nullable FK | |
| `requester_user_id` | uuid nullable | |
| `provider_user_id` | uuid nullable | |
| `provider_business_id` | uuid nullable | |
| `provider_entity_type` | text | content_item/store/product/business |
| `provider_entity_id` | uuid/text | |
| `channel` | text | lajukan_chat, whatsapp, phone, manual |
| `status` | text | draft, sent, opened, contacted, responded, negotiating, succeeded, failed, spam_or_invalid |
| `outcome_reason` | text nullable | |
| `notes` | text nullable | |
| `idempotency_key` | text nullable unique | |
| `created_by` | uuid nullable | |
| `created_at`, `updated_at` | timestamptz | |

Indexes:

- `(requirement_review_id, created_at desc)`;
- `(provider_user_id, status)`;
- `(requester_user_id, status)`;
- `(status, updated_at desc)`.

### `crm_matching_feedback`

Stores admin/user/system learning signal.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `connection_id` | uuid nullable FK | |
| `matching_candidate_id` | uuid nullable FK | |
| `requirement_review_id` | uuid nullable FK | |
| `feedback_source` | text | admin, requester, provider, system |
| `feedback_type` | text | approved, rejected, contacted, responded, succeeded, failed, corrected_extraction |
| `reason_code` | text nullable | |
| `note` | text nullable | |
| `metadata` | jsonb | |
| `created_by` | uuid nullable | |
| `created_at` | timestamptz | |

### `crm_audit_logs`

Append-only audit trail.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid PK | |
| `entity_type` | text | requirement, extraction, match_run, candidate, connection, setting |
| `entity_id` | uuid/text | |
| `action` | text | |
| `actor_user_id` | uuid nullable | |
| `actor_role` | text nullable | |
| `before` | jsonb nullable | |
| `after` | jsonb nullable | |
| `reason` | text nullable | |
| `request_id` | text nullable | |
| `created_at` | timestamptz | |

## Legacy `crm_leads`

`crm_leads` should not be deleted. It is live compatibility surface.

Near-term usage:

- Keep existing routes stable.
- Stop or gate passive event creation if implementation work begins.
- Use it as legacy signal/dashboard source while new matching entities become canonical.
- Do not overload it with extraction/candidate JSON beyond transition metadata.

## Event Model

Recommended events:

| Event | Producer | Consumer |
| --- | --- | --- |
| `requirement.created` | marketplace/www | CRM matching |
| `requirement.reviewed` | CRM | analytics/audit |
| `match.run_requested` | CRM | matching worker/service |
| `match.run_completed` | matching | CRM/analytics |
| `match.candidate_reviewed` | CRM | analytics |
| `connection.created` | CRM | notification/chat |
| `connection.contacted` | chat/WhatsApp/events | CRM/analytics |
| `connection.outcome_recorded` | CRM | analytics/scoring feedback |

All cross-service event handling needs idempotency.

## Data Retention And Privacy

- Keep original user text for audit, but mask unnecessary phone/email in logs.
- Do not store raw uploaded images in CRM tables; store media references.
- Delete or anonymize personal data according to account deletion policy.
- Internal admin views must be role-limited and audited.

## Migration Strategy

1. Add new tables additively.
2. Backfill `crm_requirement_reviews` from active `content_items` requests.
3. Keep old CRM lead API untouched.
4. Add new internal APIs under `/v1/crm/*`.
5. Move frontend CRM pages one by one to matching model.
6. Later decide whether to split `crm_service`.
