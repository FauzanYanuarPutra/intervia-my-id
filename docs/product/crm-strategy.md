# CRM Strategy

Status: product direction 2026-07-11.

## 2026-07-11 Direction Clarification

This document describes the broader owner CRM idea from an earlier product input. The current implementation priority is clarified by `docs/crm/CRM_PRODUCT_SPEC.md`: build internal Lajukan Match CRM first, not a seller-owned sales CRM. Owner/seller CRM remains a future mode after internal matching, verification, connection tracking, and analytics are stable.

This document turns the CRM notes from the 2026-07-11 product input into a working product strategy. It describes the CRM Lajukan should build, while separating that target from what already exists in the repository.

## Product Positioning

CRM Lajukan is not a corporate CRM full of tables and heavy forms.

CRM Lajukan should be a daily operating center for Indonesian sellers, suppliers, service providers, and UMKM owners:

- who needs a reply,
- who needs follow-up,
- which offer is waiting,
- which order is close to being paid,
- which older customer should be contacted again.

The simplest product sentence is:

> CRM Lajukan helps business owners manage prospects, conversations, offers, orders, and repeat customers from Lajukan and WhatsApp.

## Two CRM Modes

| Mode | User | Main Job | Product Surface |
| --- | --- | --- | --- |
| Owner CRM | UMKM owner, supplier, service provider, venue owner, admin/sales staff | Manage prospects and customers generated from listings, chat, WhatsApp, requirements, offers, and orders | `crm.lajukan.com`, Kelola Usaha, or a dedicated owner workspace |
| Internal CRM | Lajukan ops, support, sales, verification, partnership team | Manage merchants, verification, reports, tickets, subscriptions, partner outreach, and assisted onboarding | Internal CRM app/admin surface |

Both modes can share primitives, but records must be separated by `workspace_id`, `business_id`, ownership, role, and permission. Internal ops should never see private owner CRM data without an explicit support/admin reason and audit trail.

## Current Repository Reality

Current CRM is already present but is closer to an internal command center:

- `frontend/crm` has CRM dashboard, pipeline, users, listings, transactions, chat, analytics, disputes, and settings.
- `frontend/crm/src/context/AuthContext.tsx` allows roles `sales`, `admin`, `support`, and `super_admin`.
- `frontend/www/src/app/api/crm/*` proxies CRM requests to marketplace service.
- `services/marketplace_service/migrations/20260224120000_crm_leads.up.sql` creates `crm_leads` and `crm_activities`.
- `services/marketplace_service/src/main.rs` exposes `/v1/crm/leads`, `/v1/crm/leads/{id}`, and `/v1/crm/activities`.
- Existing lead stages normalize to `lead`, `qualified`, `negotiation`, `contract`, `won`, and `lost`.

So the next step is not to invent CRM from zero. The next step is to evolve the existing CRM into an owner-friendly CRM without breaking internal ops.

## Product Principles

1. Action first, reports second.
   The first screen should show what to do today, not a big analytics dashboard.

2. Indonesian UMKM language.
   Use `Pelanggan`, `Calon pelanggan`, `Penawaran`, `Pesanan`, `Tugas`, `Belum dibalas`, not heavy English CRM terms.

3. High-intent actions create CRM records.
   Passive views belong to analytics, not CRM.

4. WhatsApp is a first-class channel.
   Lajukan chat can start the relationship, but WhatsApp is often where Indonesian sellers close the deal.

5. Pipeline templates before custom pipelines.
   Most target users should not be asked to design a pipeline from scratch.

6. CRM should help, not automate recklessly.
   AI can summarize and suggest replies, but should not send messages, change prices, or accept deals without user approval.

## Lead Creation Rules

Do not create leads for every listing view. Create or update a CRM lead only when intent is strong.

| User Action | CRM Behavior | Notes |
| --- | --- | --- |
| Opens listing detail | Analytics only | Useful for demand data, not a lead |
| Clicks WhatsApp or chat seller | Create/update contact and active lead | Track source listing and response SLA |
| Sends Lajukan chat message | Create/update lead and conversation link | Store `conversation_id`, not duplicate full chat |
| Submits "Saya tertarik" | Create/update lead | High purchase intent |
| Creates requirement/kebutuhan | Create lead in buyer/supplier pipeline | Can later match suppliers |
| Requests quote | Create/update lead and quote draft | Strong intent |
| Seller answers a requirement | Create lead/opportunity | Track provider response |
| Saves phone/WhatsApp number | Create/update lead if linked to listing | Lower confidence than chat, but still intent |
| Starts order/payment | Create/update lead and order link | Stage moves closer to won |
| Incoming WhatsApp/Instagram message | Create/update contact and lead | Requires integration consent |
| Imported CSV/ad form | Create lead with source metadata | Must preserve consent/source |

## Core Objects

| Object | Purpose | MVP? |
| --- | --- | --- |
| Workspace | Separates owner CRM and internal CRM scope | Yes |
| Business | Seller/provider business profile tied to workspace | Yes |
| Contact/Pelanggan | Person or business contact with WA/email/city/source | Yes |
| Lead/Peluang | Active opportunity or need being followed up | Yes |
| Conversation | Link to Lajukan chat/WhatsApp/Instagram/email thread | Yes, as reference |
| Activity | Timeline note, stage change, message event, payment event | Yes |
| Task | Follow-up reminder and owner assignment | Yes |
| Listing | Product/service/place/opportunity related to the lead | Yes, by reference |
| Requirement/Kebutuhan | Buyer request that can generate supplier leads | Yes, by reference |
| Quote/Penawaran | Price, quantity, expiry, terms, PDF/link | V1 |
| Order/Pesanan | Accepted offer or transaction status | V1.5 |
| Payment | Payment state and link to wallet/provider events | V1.5 |
| Ticket | Complaint/support case | Internal CRM |
| Source | Lajukan, WhatsApp, Instagram, referral, ads, import | Yes |

## Pipeline Templates

### Product/Supplier Sales

1. Lead Baru
2. Sudah Dihubungi
3. Kebutuhan Cocok
4. Penawaran Dikirim
5. Negosiasi
6. Menunggu Pembayaran
7. Berhasil
8. Tidak Jadi

### Services

1. Pertanyaan Baru
2. Konsultasi
3. Survei/Pertemuan
4. Penawaran
5. Dijadwalkan
6. Sedang Dikerjakan
7. Selesai
8. Tidak Jadi

### Buyer Requirement / Mencari Supplier

1. Kebutuhan Dibuat
2. Mencari Penyedia
3. Penawaran Masuk
4. Membandingkan
5. Penyedia Dipilih
6. Transaksi
7. Selesai

Existing technical stages can remain for now, but the UI should map them to Indonesian labels per pipeline type.

## MVP Screens

### 1. Ringkasan

The dashboard should answer: "Apa yang harus saya kerjakan hari ini?"

Required cards:

- lead baru,
- chat belum dibalas,
- tugas hari ini,
- penawaran menunggu keputusan,
- pembayaran tertunda,
- transaksi bulan ini,
- pelanggan lama yang perlu dihubungi.

### 2. Inbox

Unified inbox is the most important CRM screen after the dashboard.

MVP can start with Lajukan chat links and last-message summaries. WhatsApp inbox comes after the business integration is stable.

Desktop layout:

- chat list,
- active conversation,
- customer/lead context panel.

Mobile layout:

- list first,
- conversation detail,
- fixed actions: WhatsApp, Telepon, Buat Penawaran.

### 3. Pipeline

Use horizontal Kanban with compact cards:

- name,
- need/product,
- value,
- city,
- source,
- follow-up time,
- owner/PIC,
- unread/overdue marker.

Use color sparingly:

- red: overdue,
- yellow: needs follow-up,
- green: won,
- gray: inactive/lost.

### 4. Customer Detail

Show:

- contact data,
- business/company if any,
- WA/phone/email/city,
- active lead stage,
- listing or requirement,
- timeline,
- notes,
- tasks,
- quotes,
- orders.

### 5. Penawaran

Fields:

- customer,
- product/service,
- quantity,
- unit price,
- discount,
- delivery cost,
- note,
- expiry,
- payment terms.

States:

- Draft,
- Dikirim,
- Dibuka,
- Diterima,
- Ditolak,
- Kedaluwarsa.

## Release Plan

| Version | Scope | Do Not Build Yet |
| --- | --- | --- |
| CRM V1 | Contacts, leads, pipeline, Lajukan chat reference, tasks, timeline, simple quotes, action-first dashboard | Full accounting, automation builder, external inbox sprawl |
| CRM V1.5 | WhatsApp Cloud API, orders, payment status, team assignment, notifications, CSV import | Instagram/Gmail/accounting integrations unless WhatsApp works |
| CRM V2 | Instagram, Gmail, Google Calendar, Google Sheets, Jurnal/Accurate export, AI assistant, advanced reports | AI autonomous sales actions |

## AI Role

AI should be a helper, not the owner of the relationship.

Good AI use:

- summarize long conversations,
- draft replies,
- extract customer need from chat,
- suggest follow-up time,
- draft an offer,
- detect serious leads,
- detect inactive customers,
- write weekly sales summary.

Unsafe AI use for early versions:

- sending messages automatically,
- changing price,
- accepting quote/order,
- promising delivery/payment guarantees,
- labeling users as fraud without review.

## Non-Goals For MVP

- Full ERP.
- Full bookkeeping/accounting.
- Fully custom pipeline builder.
- Multi-channel automation builder.
- In-app transaction requirement before trust and WhatsApp flows are proven.
- Importing entire WhatsApp history without consent.

## Success Metrics

| Metric | Why It Matters |
| --- | --- |
| New leads created from high-intent actions | Measures CRM usefulness without polluting data |
| Median seller response time | Directly impacts conversion and trust |
| Leads with scheduled follow-up | Shows CRM is reducing forgotten prospects |
| Quote sent rate | Measures movement from conversation to transaction |
| Quote accepted rate | Measures commercial value |
| Lost reason coverage | Helps sellers learn why leads disappear |
| Repeat customer follow-up rate | Measures retention behavior |
| WhatsApp click to lead conversion | Validates CTA and tracking |
