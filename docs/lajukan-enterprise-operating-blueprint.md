# Lajukan Enterprise Operating Blueprint

Dokumen ini adalah blueprint enterprise untuk menjadikan Lajukan sebagai Business Operating System berbasis AI: marketplace, CRM, ERP, POS, finance, CMS, community, reels, maps, automation, analytics, dan AI intelligence layer dalam satu ekosistem yang sederhana di UI tetapi kuat di backend.

Dokumen ini melengkapi `docs/lajukan-ai-operating-system.md`. Dokumen AI OS menjelaskan event, AI decision engine, CRM automation, fraud, dan recommendation. Dokumen ini menjelaskan arsitektur enterprise end-to-end, domain boundary, data, security, deployment, dan roadmap.

## 1. Executive Architecture Decision

Keputusan arsitektur utama:

Lajukan sebaiknya memakai hybrid modular architecture dengan event backbone.

Jangan langsung menjadi microservices penuh untuk semua modul. Itu akan mahal, lambat, dan sulit dioperasikan. Namun jangan juga menjadi monolith besar tanpa domain boundary. Lajukan butuh modular core yang bisa dipecah bertahap ketika domain sudah matang.

Model yang disarankan:

```text
Client Apps
  -> API Gateway / BFF
  -> Domain Services
  -> Domain Databases / Schemas
  -> Event Backbone
  -> Data Platform
  -> AI Decision Layer
  -> Automation Orchestrator
  -> CRM / ERP / POS / Notification / Risk Actions
```

Prinsip:

- Domain service adalah source of truth.
- AI tidak boleh langsung mengubah saldo, role, ownership, KYC, atau status transaksi.
- Semua domain action menghasilkan event.
- Semua event masuk data platform.
- Automation boleh menyarankan atau membuat command, tetapi domain service tetap validasi.
- UI harus progressive complexity: user awam melihat alur sederhana, fitur lanjutan muncul saat dibutuhkan.

## 2. Current System Fit

Kondisi repo saat ini sudah mengarah ke hybrid:

| Area | Current asset |
| --- | --- |
| Identity | `backend/rust_apps/identity_service` |
| Marketplace, transaction, wallet, CRM seed | `backend/rust_apps/marketplace_service` |
| Community, reels, forum | `backend/rust_apps/community_service` |
| AI verification | `backend/rust_apps/ai_service` |
| Chat realtime | `backend/chat_service` |
| WWW app | `frontend/www` |
| CRM app | `frontend/crm` |
| CMS app | `frontend/cms` |
| Usaha app | `frontend/usaha` |
| Mobile webview | `frontend/mobile` |
| OLTP | PostgreSQL |
| Cache/rate/session | Redis |
| Queue | RabbitMQ |
| Chat/event high volume candidate | ScyllaDB |
| Vector store candidate | Qdrant |

Target evolusi:

```text
Now:
  Rust domain services + Elixir chat + Next apps + Postgres/Redis/RabbitMQ/Scylla

Next:
  Add event collector, outbox workers, analytics store, automation service, risk service

Later:
  Split finance ledger, CRM orchestration, search, recommendation, and ERP/POS only when load and team ownership justify it
```

## 3. Target System Architecture

```text
                                            +------------------+
                                            |  Admin / CRM App |
                                            +---------+--------+
                                                      |
+------------+       +------------------+             |
| Web/Mobile | ----> | API Gateway/BFF  | <-----------+
+------------+       +--------+---------+
                              |
      +-----------------------+------------------------+
      |                       |                        |
+-----v------+        +-------v-------+        +-------v-------+
| Identity   |        | Marketplace   |        | Community     |
| Auth/KYC   |        | Catalog/Order |        | Feed/Reels    |
+-----+------+        +-------+-------+        +-------+-------+
      |                       |                        |
+-----v------+        +-------v-------+        +-------v-------+
| User/Trust |        | Wallet/Escrow |        | Moderation    |
+-----+------+        +-------+-------+        +-------+-------+
      |                       |                        |
      +-----------+-----------+-----------+------------+
                  |
           Transactional Outbox
                  |
          +-------v--------+
          | Event Backbone |
          +-------+--------+
                  |
    +-------------+-------------+
    |                           |
+---v-----------+        +------v----------+
| Data Platform |        | Automation      |
| Lake/Warehouse|        | Orchestrator    |
+---+-----------+        +------+----------+
    |                           |
+---v-----------+        +------v----------+
| AI/ML Layer   | -----> | CRM/Notif/Tasks |
| Ranking/Risk  |        | Actions         |
+---------------+        +-----------------+
```

## 4. Domain Boundary

Lajukan harus punya domain boundary yang jelas supaya tidak semua logic masuk frontend atau satu service besar.

| Domain | Source of truth | Tidak boleh dilakukan oleh |
| --- | --- | --- |
| Identity | user, session, OTP, device, role, permission | Frontend, CRM manual tanpa audit |
| Trust/KYC | verification status, risk tier, document summary | AI direct mutation |
| Marketplace | listing, service, supplier, demand, rating | Frontend dummy data |
| Transaction | order state machine, escrow, dispute, refund | AI, client-side state |
| Wallet/Finance | ledger, balance, payout, withdrawal | Any non-ledger update |
| CRM | lead, lifecycle, SLA, follow-up, owner | scattered frontend localStorage |
| ERP | inventory, purchase order, warehouse, supplier ops | marketplace listing logic |
| POS | sale, receipt, branch, payment sync | finance without ledger event |
| Community | groups, posts, comments, moderation | homepage hardcoded feed |
| Reels | video, action, impression, conversion | local-only mock list |
| Search | index, ranking, filters, semantic intent | per-page ad hoc filtering |
| Maps | store location, geospatial query, route action | static UI-only pins |
| Automation | workflow definitions, jobs, retries, audit | hidden setTimeout/client actions |
| AI | model score, recommendation, decision log | source of truth mutation |

Rule: Every domain command must validate auth, ownership, tenant, idempotency, and audit.

## 5. Module Dependency Map

| Module | Depends on | Produces events | Consumed by |
| --- | --- | --- | --- |
| Auth | OTP, device, IP, session | auth.login, auth.failed, auth.otp_verified | Fraud, CRM, Trust |
| Profile | Identity, KYC, media | profile.updated, profile.completed | Search, Talent, Trust |
| Marketplace | Profile, catalog, media | listing.created, listing.clicked | Search, CRM, Reco |
| Search | Catalog, profile, maps, reels | search.submitted, result.clicked | Reco, CRM, Analytics |
| Maps | Stores, geodata, rating | maps.opened, pin.clicked, route.clicked | Reco, Location AI |
| Chat | Identity, room membership | chat.opened, message.sent, lead.abandoned | CRM, Fraud, AI assistant |
| Transaction | Chat, listing, wallet | transaction.created, payment.succeeded | CRM, Finance, Fraud |
| Wallet | Payment provider, ledger | ledger.posted, payout.requested | Finance, Risk, CRM |
| Community | Profile, groups, content | post.created, comment.created | Reco, Moderation, Retention |
| Reels | Content, products, profile | reel.viewed, reel.completed, reel.cta_clicked | Reco, CRM, Growth |
| CRM | Events, user, lead, transaction | lead.created, followup.sent, lead.won | Automation, BI |
| ERP | Inventory, supplier, PO | stock.changed, po.created | POS, Finance, AI ops |
| POS | Inventory, wallet, customer | pos.sale.completed | Finance, CRM, Loyalty |
| Finance | Ledger, invoice, tax | invoice.issued, payout.settled | BI, Risk, Owner dashboard |
| Automation | Event rules, user consent | workflow.triggered, job.completed | CRM, Notification |
| AI | Events, features, warehouse | ai.decision.created | Ranking, Risk, Automation |

## 6. CRM, ERP, POS Workflow

### CRM Flow

```text
Visitor searches supplier
  -> event: search.submitted
  -> user clicks listing
  -> event: search.result_clicked
  -> opens chat
  -> event: chat.opened
  -> CRM lead created or updated
  -> SLA timer starts
  -> seller replies or automation reminds
  -> offer/order created
  -> lead converted to transaction
  -> post-transaction retention campaign
```

CRM objects:

| Object | Purpose |
| --- | --- |
| Account | user or business entity |
| Contact | person inside account |
| Lead | user intent not yet converted |
| Deal | negotiation or potential transaction |
| Activity | search, chat, route, call, email, WhatsApp |
| SLA | response deadline, escalation |
| Campaign | onboarding, retention, reactivation |
| Task | manual action for agent |
| AutomationRun | workflow execution with audit |

CRM must not become a separate silo. Every marketplace, chat, search, maps, and transaction event can become CRM signal.

### ERP Flow

```text
Seller gets order
  -> reserve inventory
  -> create picking task
  -> update stock
  -> shipping purchased
  -> delivery tracked
  -> finance ledger posted
  -> supplier performance updated
```

ERP objects:

| Object | Purpose |
| --- | --- |
| InventoryItem | stock unit |
| StockMovement | append-only movement |
| Warehouse | physical location |
| PurchaseOrder | procurement |
| SupplierContract | supplier terms |
| ApprovalRequest | manager approval |
| Asset | equipment or property |

### POS Flow

```text
Branch sale
  -> payment confirmed
  -> receipt issued
  -> inventory decremented
  -> loyalty point posted
  -> customer profile updated
  -> finance ledger posted
```

POS must work offline-first later, but MVP can be online-first with queued local events.

## 7. Data Architecture

Recommended storage choices:

| Need | Recommended system | Why |
| --- | --- | --- |
| OLTP source of truth | PostgreSQL | strong constraints, transactions, ledger integrity |
| Cache/session/rate limit | Redis | low latency and simple ops |
| Event backbone v1 | RabbitMQ + transactional outbox | already present and cheaper than Kafka early |
| Event backbone scale phase | Redpanda/Kafka | replayable streams, analytics, ML features |
| Chat messages high write | ScyllaDB | high-volume append workload |
| Search | Meilisearch/OpenSearch | typo tolerance and business search |
| Analytics realtime | ClickHouse | fast event analytics and funnels |
| Warehouse/lake | S3-compatible object storage + dbt | durable historical data |
| Vector search | Qdrant | semantic search and recommendations |
| Media | S3/MinIO + CDN | secure object storage |

Do not store business-critical money state in cache, search index, AI feature store, or frontend.

### Data Layers

```text
Postgres domain DB
  -> outbox table
  -> event relay
  -> event bus
  -> raw event lake
  -> ClickHouse realtime analytics
  -> warehouse models
  -> feature store
  -> model training/scoring
```

### Core ERD Direction

This is not the final SQL, but the target relationship map.

```text
users
  id, email, phone, status, created_at

user_profiles
  user_id, username, full_name, avatar_url, cover_url, location, profile_completion

business_accounts
  id, owner_user_id, name, slug, category, verified_status, trust_tier

business_locations
  id, business_id, lat, lng, address, geohash, service_area

listings
  id, owner_user_id, business_id, type, title, price, status, location_id

listing_media
  id, listing_id, media_url, media_type, sort_order

leads
  id, account_id, source, intent, stage, owner_user_id, score, sla_due_at

lead_activities
  id, lead_id, event_id, activity_type, occurred_at

transactions
  id, buyer_id, seller_id, listing_id, state, amount, currency, risk_state

wallet_accounts
  id, owner_id, currency, status

ledger_entries
  id, wallet_id, transaction_id, direction, amount, balance_after, idempotency_key

inventory_items
  id, business_id, sku, name, stock_policy

stock_movements
  id, inventory_item_id, quantity_delta, reason, reference_id

community_groups
  id, slug, name, visibility, category_id

community_posts
  id, group_id, author_id, content, status

reels
  id, author_id, media_id, product_id, status

events
  event_id, event_name, actor_id, entity_type, entity_id, properties, occurred_at

ai_decisions
  id, actor_id, decision_type, model_version, policy_version, inputs_ref, output, guardrail_result

automation_workflows
  id, name, trigger_event, conditions, actions, status

automation_runs
  id, workflow_id, event_id, status, attempt, next_retry_at
```

### Ledger Rule

Wallet balance must never be updated directly.

Only ledger entries can change balance:

```text
command: topup.confirmed
  -> validate payment callback signature
  -> insert ledger debit/credit in transaction
  -> update cached balance from ledger
  -> emit ledger.posted
```

## 8. Event-Driven Architecture

Every mutation that matters must produce an event.

Event categories:

| Category | Example |
| --- | --- |
| Identity | auth.login_succeeded, auth.otp_verified |
| Trust | kyc.submitted, trust.tier_changed |
| Discovery | search.submitted, maps.pin_clicked |
| Marketplace | listing.created, offer.sent |
| Chat | chat.opened, message.sent |
| Transaction | transaction.created, escrow.held |
| Finance | ledger.posted, payout.requested |
| CRM | lead.created, task.completed |
| Community | post.created, group.joined |
| Reels | reel.viewed, reel.completed |
| Automation | workflow.triggered, job.failed |
| AI | ai.decision.created, ai.recommendation_served |

Use transactional outbox for every source-of-truth service:

```text
Domain transaction:
  update domain table
  insert outbox event
  commit

Outbox relay:
  poll unpublished outbox rows
  publish to RabbitMQ/stream
  mark published
```

This prevents lost events.

## 9. AI Architecture

AI layer is split into four layers:

```text
1. Data collection
2. Feature computation
3. Decision/scoring
4. Action orchestration
```

### AI Modules

| AI module | Input | Output | Guardrail |
| --- | --- | --- | --- |
| Recommendation | click, search, purchase, location, profile | ranked items | never hide exact match unfairly |
| CRM assistant | lead activity, chat summary, SLA | next best action | no auto-send without consent |
| Search AI | query, catalog, vector embeddings | intent, semantic ranking | exact keyword fallback |
| Fraud AI | device, velocity, transaction, chat | risk score, review reason | explainability and appeal |
| Finance AI | ledger, cashflow, invoice | anomaly, forecast | cannot mutate ledger |
| Operations AI | stock, PO, demand | reorder suggestion | owner approval for purchase |
| Content AI | topic, reels, SEO | content suggestion | moderation before publish when risky |
| Community AI | post/comment/reports | moderation score | human review for severe action |

### Feature Store

Feature examples:

| Feature | Owner |
| --- | --- |
| seller_response_minutes_p50 | CRM/Search |
| seller_completion_rate_30d | Marketplace |
| buyer_payment_success_rate | Risk |
| listing_ctr_7d | Recommendation |
| query_to_chat_rate | Search |
| map_pin_to_route_rate | Maps |
| reel_watch_completion_rate | Reels |
| account_age_days | Fraud |
| device_account_count | Fraud |
| inventory_stockout_frequency | ERP |

### AI Decision Contract

Every AI decision must be logged:

```json
{
  "decision_id": "uuid",
  "decision_type": "lead_next_best_action",
  "actor_user_id": "uuid",
  "entity_type": "lead",
  "entity_id": "uuid",
  "model_version": "lead-score-v1.3",
  "policy_version": "crm-policy-v2",
  "score": 0.82,
  "recommendation": "send_followup",
  "reason_codes": ["high_intent", "seller_no_reply_2h"],
  "guardrail": {
    "allowed": true,
    "requires_human": false
  }
}
```

## 10. Recommendation System

Use phased recommendation, not one giant ML system.

Phase 1: rules + ranking score

```text
score =
  text_match
  + trust_score
  + response_speed
  + location_relevance
  + inventory_availability
  + recent_conversion
  - dispute_risk
```

Phase 2: hybrid ranking

- collaborative filtering
- content-based similarity
- semantic embeddings
- location-aware ranking
- business graph proximity

Phase 3: learning-to-rank

- train from impression, click, chat, transaction, repeat order
- use online experiment framework
- never ship model without fallback ranking

Surfaces:

| Surface | Ranking objective |
| --- | --- |
| Home | fast first useful action |
| Search | intent match and conversion |
| Maps | nearby relevance and trust |
| Reels | watch time plus business conversion |
| Community | engagement quality, not just noise |
| CRM | next best action and SLA |

## 11. Search Architecture

Search must be unified but typed.

```text
Query: "supplier kemasan murah bandung"
  -> intent parser
  -> entity type candidates: supplier, product, location
  -> filters: price sensitive, city Bandung
  -> keyword search + semantic search
  -> ranking service
  -> result cards
  -> event tracking
```

Search index:

| Index | Data |
| --- | --- |
| listing_index | product, service, property, opportunity |
| business_index | stores, suppliers, maps locations |
| user_talent_index | skill, work mode, rating, trust |
| community_index | groups, posts |
| reels_index | title, topic, product tags |

Rule: Search result payload should be backend-composed. Frontend must not invent dummy items.

## 12. Security Architecture

Security model:

```text
Zero Trust + least privilege + defense in depth + audit everything
```

### Authentication

- email/phone OTP
- password login for staff/admin
- MFA for CRM/admin
- device binding for sensitive staff access
- refresh token rotation
- session revocation
- suspicious login detection

### Authorization

Use RBAC + ABAC.

RBAC answers: what role can generally do.
ABAC answers: can this actor do this action on this resource now.

Examples:

```text
role: support
action: view_transaction
condition:
  assigned_case = true OR permission = transaction.read_support

role: finance
action: approve_withdrawal
condition:
  amount <= approval_limit AND step_up_otp_recent = true

role: business_owner
action: edit_listing
condition:
  listing.owner_id = actor.user_id OR actor.business_role = admin
```

### Sensitive Actions

Must require step-up OTP or MFA:

- approve payout
- manual wallet adjustment
- trust tier change
- KYC override
- refund
- dispute resolution
- role change
- API key creation
- CRM export

### API Security

- API gateway rate limits
- per-user and per-device throttling
- idempotency key for payment/order mutations
- signed webhook validation
- CSRF protection for cookie auth
- CORS allowlist
- payload size limit
- strict file upload validation
- SSRF protection for remote media fetch
- audit log for staff actions

### Fraud Detection

Risk signals:

| Signal | Example |
| --- | --- |
| Account | account age, verification, duplicate phone/email |
| Device | device hash, multiple accounts, emulator |
| Network | IP reputation, proxy/VPN, velocity |
| Behavior | spam chat, repeated failed payment |
| Transaction | amount anomaly, buyer/seller relationship |
| Marketplace | fake review, fake engagement |
| Content | scam keyword, phishing link |

Risk action ladder:

```text
allow
  -> soft warning
  -> rate limit
  -> step-up verification
  -> hold transaction
  -> manual review
  -> suspend
```

## 13. Automation Engine

Architecture:

```text
Event
  -> Rule matcher
  -> Workflow run
  -> Action adapter
  -> Audit log
  -> Retry/dead-letter
```

Workflow examples:

| Trigger | Condition | Action |
| --- | --- | --- |
| search.submitted | no chat after 10 min | recommend 5 suppliers |
| chat.opened | seller no reply in 2 hours | reminder to seller |
| listing.created | missing photo | task: improve listing |
| payment.failed | retryable method | send alternate payment guide |
| kyc.rejected | quality low | show upload tips |
| lead.stale | high score and no owner | assign to CRM |
| reel.cta_clicked | product exists | create warm lead |

Automation safety:

- every action has idempotency key
- every external send has consent policy
- every retry has max attempts
- every failed workflow goes to dead-letter queue
- high-risk actions require human approval

## 14. CRM Growth Engine

CRM should act as revenue engine, not admin table.

Lead scoring:

```text
lead_score =
  intent_strength
  + profile_quality
  + business_value
  + urgency_signal
  + engagement_depth
  - fraud_risk
```

Lifecycle:

```text
anonymous
  -> registered
  -> activated
  -> qualified lead
  -> negotiating
  -> paid
  -> completed
  -> retained
  -> advocate/seller
```

Each stage must have:

- owner
- SLA
- next action
- drop reason
- automation
- KPI

## 15. ERP and POS Growth Path

Do not build full Odoo on day one.

Phase ERP/POS:

1. Inventory and stock movement for sellers.
2. Simple POS sale and receipt.
3. Multi-branch and staff role.
4. Purchase order and supplier management.
5. Accounting integration.
6. Forecasting and AI reorder suggestion.

Core rule: ERP/POS must sync into CRM and finance.

Example:

```text
POS sale completed
  -> customer profile updated
  -> inventory decremented
  -> ledger entry posted
  -> loyalty points posted
  -> recommendation model updated
```

## 16. Finance and Accounting

Finance is safety-critical.

Core objects:

- invoice
- payment
- wallet account
- ledger entry
- payout
- withdrawal
- receivable
- payable
- tax summary

Hard rules:

- use integer minor units for money
- use currency column everywhere
- never trust frontend amount
- validate payment callbacks with provider signature
- require idempotency keys
- immutable ledger
- manual adjustment requires step-up MFA and audit
- withdrawal requires bank account ownership verification

## 17. Realtime Architecture

Use different realtime patterns by domain:

| Domain | Realtime type |
| --- | --- |
| Chat | websocket |
| Notifications | SSE/websocket |
| Order tracking | SSE for web, push for mobile |
| Dashboard metrics | polling or SSE |
| Fraud alert | queue to CRM/admin |
| POS sync | local queue + sync worker |

Do not use websocket for everything.

## 18. API Architecture

Recommended API layers:

```text
Public Client
  -> Next BFF routes
  -> API Gateway
  -> Domain service

Staff CRM
  -> CRM BFF routes
  -> API Gateway
  -> Domain service with staff policy

Internal workers
  -> service-to-service auth
  -> domain commands
```

API standards:

- versioned URLs: `/v1/...`
- cursor pagination
- stable error format
- idempotency key for mutations
- request id and trace id
- explicit ownership checks
- no sensitive fields by default
- response contracts documented via OpenAPI

Error shape:

```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSION",
    "message": "Akses tidak tersedia.",
    "request_id": "uuid",
    "details": {}
  }
}
```

## 19. Observability

Minimum enterprise observability:

| Signal | Tooling direction |
| --- | --- |
| Logs | structured JSON logs |
| Metrics | Prometheus compatible |
| Traces | OpenTelemetry |
| Errors | Sentry or equivalent |
| Product analytics | event lake + ClickHouse |
| Audit | append-only audit table |
| Security alerts | SIEM-ready stream |

Golden signals:

- latency
- traffic
- errors
- saturation
- queue lag
- DB connection usage
- payment failure rate
- OTP failure rate
- lead SLA breach
- fraud review backlog

## 20. Deployment Architecture

Recommended path:

### Development

- Docker Compose remains acceptable.
- Seed realistic data through migrations.
- Use local MinIO and local mail/OTP dev mode.

### Staging

- same topology as production at smaller scale
- real payment sandbox
- real shipping sandbox
- isolated credentials
- data reset schedule
- E2E smoke tests before deploy

### Production

- container orchestration: Kubernetes or managed container platform
- managed Postgres with PITR backup
- managed Redis
- managed object storage
- CDN/WAF in front of web
- separate internal network for services
- secrets manager
- blue/green or canary deploy
- database migration gate

Do not expose internal services directly to browsers. Use BFF/API gateway.

## 21. CI/CD Architecture

Pipeline:

```text
Pull request
  -> lint
  -> typecheck
  -> unit tests
  -> security scan
  -> build images
  -> integration tests
  -> migration dry run
  -> deploy staging
  -> smoke tests
  -> canary production
  -> monitor
  -> promote or rollback
```

Required gates:

- no secret in repo
- dependency vulnerability threshold
- migration rollback plan
- API contract compatibility
- critical auth tests
- payment ledger tests

## 22. Disaster Recovery

RTO/RPO targets:

| System | RPO | RTO |
| --- | --- | --- |
| Identity | <= 5 min | <= 1 hour |
| Wallet/ledger | <= 1 min | <= 30 min |
| Marketplace | <= 15 min | <= 2 hours |
| Chat | <= 15 min | <= 4 hours |
| Analytics | <= 24 hours | <= 24 hours |

DR requirements:

- daily backup restore test
- point-in-time recovery for Postgres
- object storage versioning
- queue dead-letter retention
- runbook for payment incident
- runbook for account takeover
- runbook for data breach

## 23. UX Architecture Principle

Backend can be complex. UI must feel simple.

Principles:

- one primary CTA per screen
- familiar Indonesian patterns
- search first for discovery
- chat as conversion bridge
- detail hidden until user asks
- progressive forms
- no duplicate filters
- no dummy frontend data
- every empty state explains next action
- mobile first for UMKM
- desktop optimized for operators/sellers

Complexity ladder:

```text
Visitor:
  search, maps, profile, chat

New seller:
  create listing, complete profile, verify phone

Active seller:
  CRM, order, inventory, wallet

Advanced business:
  POS, ERP, finance, automation, analytics
```

## 24. Governance and Compliance

Data governance:

- classify data: public, internal, sensitive, restricted
- encrypt restricted data
- mask KTP/NIK in UI
- separate raw document storage from display summary
- audit staff access to sensitive data
- retention policy for logs and media
- user consent for AI learning and marketing

AI governance:

- model versioning
- decision logs
- human override
- appeal path for fraud/trust decisions
- bias monitoring for ranking
- no unapproved autonomous financial action

## 25. Scalability Strategy

Scale in this order:

1. Add indexes and query optimization.
2. Add caching for read-heavy public surfaces.
3. Add queue for slow side effects.
4. Add outbox and event-driven workers.
5. Split hot read models/search indexes.
6. Split domain services only when ownership/load requires it.
7. Add streaming platform when replay and high-volume analytics are needed.
8. Add multi-region only after single-region reliability is mature.

Hotspot watchlist:

- search
- home feed
- reels feed
- chat messages
- notifications
- wallet ledger
- maps geospatial query
- CRM dashboard aggregations

## 26. Implementation Roadmap

### Phase 0: Stabilize Source of Truth

- remove frontend dummy data from marketplace/community/reels/maps
- add backend-owned feeds
- add auth guard matrix
- standardize image/media handling
- standardize API error shape
- make all forms use backend validation

### Phase 1: Event Foundation

- shared event taxonomy package
- event SDK for web/mobile
- backend event emitter
- transactional outbox in domain services
- event collector endpoint
- raw event storage
- lead creation from search/chat/listing events

### Phase 2: CRM and Automation V1

- lead lifecycle table
- activity timeline
- SLA timers
- follow-up tasks
- abandoned chat/search recovery
- payment failure recovery
- CRM audit logs

### Phase 3: Search and Recommendation V1

- unified backend search
- typed search indexes
- rule-based ranking
- recommendation impression tracking
- click/chat/transaction feedback
- semantic search with Qdrant for selected surfaces

### Phase 4: Risk and Trust V1

- risk signal table
- transaction risk scoring
- staff step-up MFA
- payout/withdrawal approval workflow
- fraud case queue
- appeal and audit trail

### Phase 5: ERP/POS Foundation

- inventory item and stock movement
- simple POS sale
- receipt and payment sync
- branch and staff role
- finance ledger integration

### Phase 6: AI Learning Loop

- feature store
- model registry
- offline training
- online scoring service
- experiment framework
- model monitoring

## 27. What Not To Do

Avoid these traps:

- Do not make AI source of truth for money or permission.
- Do not put business logic in frontend.
- Do not build ERP, POS, CRM, and accounting fully before marketplace conversion works.
- Do not duplicate search, maps, and business directory into separate confusing pages without clear purpose.
- Do not make every module a microservice before team/process is ready.
- Do not use localStorage as real social graph, wallet, trust, or authorization state.
- Do not ship staff tools without audit log and MFA step-up.
- Do not optimize for feature count over user comprehension.

## 28. Enterprise Operating Blueprint Summary

Lajukan should operate as:

```text
System of Record:
  Identity, marketplace, transaction, wallet, ERP, POS, finance

System of Engagement:
  Home, search, maps, chat, reels, community, profile

System of Intelligence:
  Event platform, analytics, AI scoring, recommendation, fraud

System of Action:
  CRM, automation, notification, staff dashboard, workflow engine
```

The final shape is not "one app with many pages". The final shape is a connected operating system where every user action creates signal, every signal improves decisioning, and every decision either simplifies UX, increases conversion, reduces fraud, or improves retention.

The key discipline is this:

Every feature must answer five questions before launch:

1. What event does it emit?
2. What lifecycle stage does it move?
3. What CRM/automation action can use it?
4. What fraud/security risk does it introduce?
5. What KPI proves it works?

If a feature cannot answer those five, it is not ready for Lajukan.
