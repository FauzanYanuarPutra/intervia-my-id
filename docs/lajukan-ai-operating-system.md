# Lajukan AI Operating System

Dokumen ini mendefinisikan AI Operating System untuk Lajukan: satu sistem pembelajaran, monitoring, automation, CRM, fraud, dan recommendation yang menghubungkan semua module marketplace, komunitas, chat, transaksi, reels, maps, talent, dan usaha.

Prinsip utama: tidak ada feature yang berdiri sendiri. Semua action harus tertrack, measurable, punya lifecycle, punya automation, punya fraud guard, dan bisa dioptimalkan oleh AI.

## 1. North Star

AI Lajukan harus mengejar outcome bisnis berikut:

| Outcome | KPI utama | Kenapa penting |
| --- | --- | --- |
| User cepat paham | time to first action, bounce rate | UMKM dan buyer harus langsung tahu harus klik apa |
| Lead tidak hilang | lead response SLA, abandoned chat recovery | Setiap chat/search/request harus punya follow-up |
| Transaksi naik | GMV, payment success, order completion | Marketplace harus menghasilkan transaksi nyata |
| Seller aktif | listing created, response speed, repeat order | Supply harus sehat dan cepat respon |
| Trust naik | KYC completion, dispute rate, fraud rate | B2B/B2C butuh rasa aman |
| Retention naik | D1/D7/D30 retention, repeat session | Platform harus jadi habit bisnis |

## 2. Core Architecture

```
Client Apps
  -> Event SDK
  -> API Gateway / BFF
  -> Event Collector
  -> Stream / Queue
  -> Data Lake + Warehouse
  -> Feature Store
  -> AI Decision Engine
  -> Action Orchestrator
  -> CRM / Notification / Ranking / Fraud / Admin
```

AI tidak boleh menjadi source of truth untuk uang, role, KYC, ownership, atau status transaksi. AI memberi rekomendasi dan automation command. Backend domain service tetap melakukan validasi, authorization, idempotency, dan audit log.

### 2.1 Local Docker AI untuk Create Form

Fitur create listing boleh memakai AI lokal supaya biaya API bisa nol saat development atau operasional kecil.

Jalur provider untuk foto create form:

1. `USE_OLLAMA=true` -> `Ollama` di Docker.
2. `INTERNAL_AI_URL` -> AI service internal.
3. `OPENAI_API_KEY` -> fallback eksternal jika disediakan.

Fitur AI ringan yang aktif di create flow:

- AI baca foto listing -> isi field yang jelas saja.
- AI Paket Usaha Lite -> ide usaha, kebutuhan bahan/alat/kemasan/jasa, estimasi modal, risiko, dan link pencarian Lajukan.
- AI Paket Usaha Lite tetap berjalan tanpa model besar karena punya fallback rule-based lokal.

Contoh menyalakan mode lokal:

```powershell
.\up-super-fast.ps1
```

Mode ringan teks saja:

```powershell
.\up-super-fast.ps1 -AiTextOnly
```

Mode tanpa AI lokal:

```powershell
.\up-super-fast.ps1 -NoAi
```

Custom model:

```powershell
.\up-super-fast.ps1 -AiBusinessModel "llama3.2:3b" -AiVisionModel "llava:7b"
```

Untuk laptop RAM 24 GB, mulai dari `llama3.2:3b` untuk teks dan gunakan model vision hanya saat perlu membaca foto. Jangan menjalankan fine-tuning, Qdrant indexing besar, dan model vision besar bersamaan ketika sedang development frontend.

Guardrail wajib:

- AI service tidak dipanggil dari browser; frontend memanggil API server Lajukan.
- Port Ollama dibind ke `127.0.0.1`, bukan dibuka ke LAN/internet.
- Upload foto dibatasi tipe dan ukuran.
- Hasil AI hanya boleh mengisi field yang dikirim form sebagai allowlist.
- Field dengan confidence rendah dibuang.
- User tetap harus konfirmasi apakah hasil AI benar atau perlu diperbaiki.
- Feedback user disimpan sebagai data pembelajaran, bukan langsung fine-tune otomatis.
- Model lokal tidak diberi akses langsung ke database produksi; data DB dipakai lewat query terkontrol, retrieval, ranking, atau batch training terjadwal.

Learning loop aman:

```
foto + hasil AI + koreksi user
  -> metadata.ai_image_assist
  -> dataset evaluasi
  -> prompt/ranking improvement
  -> optional fine-tune batch setelah data cukup bersih
```

Tahap berikutnya saat data Lajukan sudah cukup:

1. Index listing supplier/bahan/mesin/jasa ke Qdrant.
2. Ambil kandidat supplier dari Meilisearch + Qdrant.
3. Ambil detail resmi dari PostgreSQL/marketplace service.
4. Biarkan Ollama hanya menyusun penjelasan dan estimasi.
5. Jangan biarkan LLM mengarang nama supplier yang tidak ada di database.

## 3. Feature Dependency Map

| Module | Bergantung pada | Memberi sinyal ke | Automation wajib |
| --- | --- | --- | --- |
| Auth | device, OTP, email, phone, IP | fraud, CRM, KYC | suspicious login alert, duplicate account review |
| Home | search, maps, reels, community, profile | recommendation, retention | personalized ranking, abandoned session recovery |
| Search | catalog, profile, maps, reels, community | supplier score, intent graph | typo correction, semantic ranking |
| Supplier | content, profile, chat, transaction | trust, CRM, recommendation | slow response reminder, quality score |
| Jasa | content, chat, transaction, rating | SLA, trust, matching | deadline reminder, dispute risk alert |
| Maps | store profile, location, rating, route | local intent, nearby ranking | hotspot insight, nearby recommendation |
| Talent | user profile, KYC, skill, rating | hiring, CRM, demand graph | match candidate, salary trend insight |
| Peluang | content, search, community, transaction | growth, recommendation | opportunity suggestion |
| Community | groups, posts, reels, profile | moderation, retention | spam/toxic detection, group recommendation |
| Reels | content, product, store, chat | discovery, conversion | watch-time ranking, product CTA optimization |
| Chat | auth, profile, listing, transaction | CRM, fraud, lead score | follow-up, summary, smart reply |
| Transaction | wallet, payment, escrow, shipping | fraud, trust, CRM | payment reminder, dispute prevention |
| CRM | all modules | automation, growth | lead assignment, lifecycle campaign |
| Recommendation | all behavior | home, search, reels, maps | personalized feed and next action |
| Fraud | auth, chat, transaction, review | risk engine, admin | hold, review, rate limit, step-up KYC |
| Retention | all inactivity signals | CRM, notification | winback, reminder, education |

## 4. Unified User Lifecycle

```
anonymous visitor
  -> intent detected
  -> registered user
  -> phone/email verified
  -> profile completed
  -> first search / first chat / first listing
  -> qualified lead
  -> negotiation
  -> transaction
  -> completion
  -> review
  -> repeat order
  -> seller / creator / community contributor
```

Every lifecycle stage must have:

- entry event
- exit event
- drop-off reason
- next best action
- CRM owner or automation
- fraud risk score
- retention trigger

## 5. Event Tracking Architecture

All frontend and backend events must use a shared envelope.

```json
{
  "event_id": "uuid",
  "event_name": "search.submitted",
  "occurred_at": "2026-05-27T00:00:00Z",
  "user_id": "uuid_or_null",
  "anonymous_id": "device_or_session_id",
  "session_id": "uuid",
  "tenant_id": "default",
  "locale": "id",
  "source": "web",
  "page": "/id/search",
  "entity_type": "listing",
  "entity_id": "uuid_or_slug",
  "properties": {},
  "context": {
    "ip_hash": "hash",
    "device_hash": "hash",
    "utm": {},
    "geo": {}
  }
}
```

Minimum events:

| Area | Events |
| --- | --- |
| Auth | auth.register_started, auth.otp_requested, auth.otp_verified, auth.login_succeeded, auth.login_failed |
| KYC | kyc.started, kyc.document_uploaded, kyc.selfie_uploaded, kyc.submitted, kyc_approved, kyc_rejected |
| Home | home.viewed, home.section_viewed, home.card_clicked, home.scroll_depth |
| Search | search.focused, search.submitted, search.result_clicked, search.filter_changed, search.no_result |
| Maps | maps.opened, maps.pin_clicked, maps.route_clicked, maps.profile_opened, maps.nearby_search |
| Listing | listing.create_started, listing.field_filled, listing.photo_uploaded, listing.published, listing.abandoned |
| Chat | chat.opened, chat.message_sent, chat.seller_replied, chat.abandoned, chat.ai_suggestion_used |
| Transaction | transaction.created, payment.started, payment.succeeded, payment.failed, escrow.held, dispute.opened |
| Reels | reels.viewed, reels.watch_25, reels.watch_50, reels.watch_100, reels.cta_clicked, reels.shared |
| Community | community.post_created, group_joined, comment_created, moderation_flagged |
| CRM | lead.created, lead.assigned, lead.followed_up, lead.converted, lead_lost |

## 6. AI Decision Engine

Decision engine returns one or more decisions for a context.

```json
{
  "decision_id": "uuid",
  "user_id": "uuid",
  "context": "home.feed",
  "decisions": [
    {
      "type": "recommendation",
      "target": "supplier",
      "entity_id": "uuid",
      "score": 0.91,
      "reason": "high_match_intent_location_fast_response"
    },
    {
      "type": "automation",
      "target": "chat_follow_up",
      "delay_minutes": 120,
      "reason": "buyer_waiting_no_seller_reply"
    }
  ],
  "guardrails": {
    "requires_auth": false,
    "risk_level": "low",
    "allowed_actions": ["rank", "notify", "recommend"]
  }
}
```

Decision hierarchy:

1. Safety and authorization guard
2. Fraud and trust scoring
3. User intent
4. Business objective
5. UX friction minimization
6. Personalization
7. Experiment policy

## 7. Recommendation Engine

Ranking score:

```
final_score =
  intent_match * 0.25 +
  semantic_similarity * 0.18 +
  location_relevance * 0.14 +
  trust_score * 0.14 +
  response_speed * 0.10 +
  conversion_history * 0.10 +
  freshness * 0.05 +
  diversity_boost * 0.04
```

Recommendation surfaces:

| Surface | Input | Output |
| --- | --- | --- |
| Home | behavior, location, recent intent | categories, suppliers, reels, maps, community |
| Search | query, filters, click history | ranked results and suggestions |
| Maps | location, category, open status | nearby businesses and route CTA |
| Reels | watch time, saves, product clicks | next reels and related products |
| Community | group, topic, engagement | posts, groups, experts |
| Chat | conversation stage | next reply, follow-up, transaction CTA |
| CRM | lead stage, SLA, value | next best action |

## 8. CRM Orchestration

CRM entity model:

- Lead: buyer intent, seller opportunity, hiring need, community lead
- Account: user or business owner
- Opportunity: transaction or order potential
- Activity: search, chat, call, route click, listing view
- SLA: expected response time by role and module
- Campaign: onboarding, reactivation, retention, upsell

Lead status:

```
new -> qualified -> contacted -> negotiating -> transaction_started -> won
new -> stale -> recovered
qualified -> lost
```

Automation examples:

| Trigger | Condition | Action |
| --- | --- | --- |
| Abandoned search | search result clicked but no chat in 10 min | show related suppliers on home |
| Slow seller | buyer message not replied in SLA | notify seller, suggest alternative supplier |
| Abandoned listing | create started but not published | send draft reminder and reduce form step |
| Payment failed | payment started but not completed | retry guide and alternate method |
| Cold user | no session in 7 days | personalized reactivation |
| High intent buyer | repeated route/profile/chat | create CRM lead |

## 9. Fraud Prevention System

Fraud score:

```
risk_score =
  device_risk +
  ip_risk +
  account_age_risk +
  velocity_risk +
  duplicate_identity_risk +
  payment_risk +
  chat_content_risk +
  review_integrity_risk
```

Actions by risk:

| Risk | Action |
| --- | --- |
| Low | allow and monitor |
| Medium | rate limit, OTP step-up, reduced visibility |
| High | hold transaction, require KYC, manual review |
| Critical | block action, freeze wallet movement, security alert |

Fraud use cases:

- duplicate accounts from same device/IP/payment identity
- fake supplier with suspicious listing velocity
- fake review rings
- buyer-seller collusion
- escrow manipulation attempts
- spam chat and phishing links
- account farming via OTP abuse

## 10. Module AI Ownership

| Module | AI owner job | Guardrail |
| --- | --- | --- |
| Auth | detect suspicious access | never block final login without backend policy |
| KYC | simplify next step and score quality | never expose raw NIK in UI analytics |
| Home | decide what user should see first | avoid dark patterns and over-personalization |
| Search | infer intent and rank | do not hide exact matches unfairly |
| Supplier | score trust and response | seller can appeal low score |
| Jasa | predict SLA and completion risk | no auto-penalty without evidence |
| Maps | rank nearby and cluster pins | do not expose precise private location |
| Talent | match skill and demand | no protected-class discrimination |
| Community | rank and moderate | human review for severe action |
| Reels | optimize watch and conversion | avoid irrelevant entertainment drift |
| Chat | smart reply and follow-up | AI only reads authorized room content |
| Transaction | detect risk and improve payment | AI never mutates balance directly |
| CRM | next best action | every automation has audit trail |

## 11. Data Model Additions

Recommended tables or collections:

- event_log: append-only raw events
- user_feature_snapshot: latest computed features per user
- entity_feature_snapshot: scores for listing, store, supplier, talent, group, reel
- ai_decision_log: every decision and reason
- automation_job: scheduled, running, completed, failed jobs
- lead: CRM lead lifecycle
- lead_activity: all CRM activity
- fraud_signal: raw fraud features
- fraud_case: review workflow
- recommendation_impression: what was shown
- recommendation_feedback: click, hide, convert, report
- experiment_assignment: A/B testing buckets

All money-related tables must stay in transaction/wallet services with ledger integrity. AI tables only reference transaction IDs and risk signals.

## 12. Realtime Analytics

Realtime pipeline:

```
Event Collector -> Stream
  -> realtime aggregations: active users, conversion, SLA, fraud velocity
  -> alert engine
  -> dashboard
  -> feature store online updates
```

Batch pipeline:

```
Warehouse -> model training -> offline scoring -> model registry -> deploy decision policy
```

## 13. Automation Architecture

Automation must be idempotent.

```json
{
  "job_type": "seller_slow_response_reminder",
  "dedupe_key": "room:{room_id}:seller_sla:{date_hour}",
  "target_user_id": "uuid",
  "payload": {
    "room_id": "uuid",
    "buyer_wait_minutes": 120
  },
  "status": "scheduled",
  "scheduled_at": "2026-05-27T10:00:00Z"
}
```

Rules:

- no duplicate reminders
- no automation without consent preference check
- no AI-generated message auto-sent as user without explicit permission
- every action creates audit log
- user can opt out of marketing automation
- transactional/security notifications still allowed by policy

## 14. Operational Dashboards

Dashboards wajib:

| Dashboard | Metrics |
| --- | --- |
| Growth | activation, retention, CAC proxy, referral |
| Marketplace | GMV, conversion, supplier response, repeat order |
| Search | zero result, CTR, query intent, filter usage |
| Maps | pin click, route click, profile open, local conversion |
| Chat | first response SLA, abandoned chat, AI suggestion usage |
| Transaction | payment success, dispute, cancel, refund, escrow aging |
| Fraud | risk distribution, blocked action, manual review backlog |
| Community | engagement quality, moderation, group growth |
| Reels | watch time, CTA conversion, creator quality |
| CRM | lead leakage, won/lost, stale leads, follow-up SLA |

## 15. AI Product Loops

Learning loop:

```
observe -> score -> decide -> act -> measure -> learn -> update policy
```

Example: buyer searches "supplier kemasan murah".

1. Search intent: supplier packaging, price sensitive, local optional.
2. Rank suppliers by trust, response speed, price relevance.
3. If user opens 3 suppliers but no chat, recommend "buat permintaan".
4. If user chats and seller slow, remind seller and suggest alternatives.
5. If deal starts, monitor payment and escrow.
6. After completion, ask review and suggest repeat order.
7. Feed result back to supplier score and future ranking.

Personal AI / AI Studio Builder loop:

1. User provides source material such as a product photo, business context, raw idea, or reference.
2. AI analyzes only visible/provided facts, then separates facts, creative assumptions, and items to confirm.
3. AI can produce practical artifacts such as product analysis, captions, Google Flow/Veo scene prompts, voice over, subtitle, negative prompt, and production checklist.
4. User stays responsible for confirming claims, pricing, legal statements, testimonials, and publishing decisions.

## 16. Privacy, Authorization, and Safety

Hard rules:

- frontend events are signals, not truth
- backend validates ownership for every entity
- AI cannot access private chat unless user is a member and feature policy allows it
- AI personal assistant only learns from messages sent by the authorized user unless explicit room policy says otherwise
- KYC data must be minimized and masked
- fraud models must be explainable enough for appeal
- all AI decisions must be logged with model version and policy version

## 17. Rollout Plan

Phase 1: foundation

- unified event SDK
- event collector
- lead table and basic CRM
- basic funnel dashboards
- fraud signal table
- AI decision log

Phase 2: conversion engine

- search intent ranking
- seller response SLA automation
- abandoned chat recovery
- abandoned listing recovery
- payment reminder

Phase 3: recommendation engine

- personalized home
- search ranking
- maps nearby ranking
- reels recommendation
- community recommendation

Phase 4: fraud and trust

- duplicate account detection
- fake supplier detection
- fake review detection
- transaction anomaly detection
- KYC step-up policy

Phase 5: autonomous growth

- next best action engine
- CRM lifecycle campaigns
- opportunity generation
- supplier quality coaching
- automated business insights

## 18. Definition of Done for Any Feature

A Lajukan feature is not done until it has:

- core backend API
- authorization check
- event tracking
- funnel KPI
- empty/error/loading state
- CRM handoff if lead exists
- fraud signal if abuse possible
- retention trigger if user drops
- recommendation input/output if relevant
- audit log for sensitive action
- dashboard visibility

## 19. Immediate Priority Backlog

1. Build event taxonomy package shared by frontend and backend.
2. Add `event_log`, `lead`, `lead_activity`, `ai_decision_log`, `automation_job`, and `fraud_signal`.
3. Track home, search, maps, chat, listing create, transaction, reels, and community events.
4. Build lead leakage dashboard: search without chat, chat without reply, transaction without payment.
5. Add seller SLA automation.
6. Add abandoned create/listing recovery.
7. Add payment failure recovery.
8. Add simple recommendation scoring using intent, location, trust, and response speed.
9. Add fraud score v1: device, IP, velocity, account age, transaction anomaly.
10. Add AI decision logs before launching any autonomous action.

## 20. Final Operating Model

Lajukan AI OS is the control layer across the ecosystem:

- Product uses it to find friction.
- CRM uses it to prevent lost leads.
- Marketplace uses it to rank supply and demand.
- Fraud uses it to reduce abuse.
- Community uses it to keep quality high.
- Reels uses it to convert attention into business action.
- Maps uses it to connect local intent to real businesses.
- Transactions use it to increase success while protecting funds.

The system goal is simple: every user action becomes a useful signal, every signal improves a decision, every decision improves conversion, trust, retention, and GMV.
