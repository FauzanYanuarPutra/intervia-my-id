# Lajukan Frontend Experience Redesign

Date: 2026-09-07
Status: Proposed design
Scope: `frontend/packages`, `frontend/apps/www`, `frontend/apps/usaha`, `frontend/apps/cms`, `frontend/apps/crm`

## 1. Goal

Create a coherent Lajukan product family across WWW, Usaha, CMS, and CRM without forcing each application into the same interaction model.

The redesign must make every application:

- simple to understand on first use;
- fast for repeat users;
- visually calm and consistent;
- mobile-friendly where the audience requires it;
- accessible by keyboard and screen reader;
- honest about data state, permissions, loading, failures, and empty states;
- easy to maintain through shared primitives instead of duplicated UI logic.

The family identity is shared, but each application optimizes for a different job:

- **WWW:** discovery, trust, and conversion.
- **Usaha:** daily business execution.
- **CMS:** editorial operations and publishing.
- **CRM:** relationship, case, risk, and operational follow-up.

## 2. Implementation Order

Work proceeds in six waves and each wave is independently reviewable and mergeable.

1. Finish active security and Usaha simplification work already in flight.
2. Shared UI foundation.
3. WWW product experience.
4. Usaha product experience polish.
5. CMS editorial workspace redesign.
6. CRM operations workspace redesign.
7. Cross-application quality, accessibility, performance, and consistency pass.

No redesign wave should mix unrelated backend work or dependency security repair.

## 3. Design Principles

### 3.1 One primary job per surface

Every important page must make its primary task obvious. Secondary actions should not compete visually with the main action.

### 3.2 Progressive disclosure

Advanced detail is available when needed but hidden from the first visual layer. This is especially important for HPP, supplier details, settlement reconciliation, moderation metadata, risk data, and internal diagnostics.

### 3.3 Durable data only

The UI must not fabricate readiness, prices, revenue, counts, margins, customer activity, or status. Missing data is represented explicitly as missing or not configured.

### 3.4 Permission-aware UX

Actions that the current role cannot perform should not be presented as actionable UI. Read-only states should explain why data is visible but not editable where relevant.

### 3.5 Actionable empty states

An empty state answers three questions:

1. What is missing?
2. Why does it matter?
3. What is the single best next action?

### 3.6 Mobile-first where appropriate

WWW and Usaha are mobile-first. CMS and CRM are desktop-first but remain usable on tablets and small screens without broken overflow, inaccessible tables, or hidden critical controls.

### 3.7 Dense does not mean noisy

Internal tools may show more data than public or merchant surfaces, but density is achieved with hierarchy, grouping, filtering, and compact controls rather than visual clutter.

## 4. Shared UI Foundation

The existing `frontend/packages` package becomes the canonical shared frontend foundation.

### 4.1 Shared tokens

Canonical tokens include:

- typography scale;
- spacing scale;
- radii;
- borders;
- elevations;
- semantic colors;
- focus ring;
- motion durations;
- content widths;
- mobile and desktop breakpoints.

Semantic states must include at least:

- neutral;
- primary;
- success;
- warning;
- danger;
- info.

Apps may use different density presets but must not redefine semantic meaning.

### 4.2 Shared primitives

Reusable primitives should cover only interaction patterns genuinely shared across apps:

- Button and IconButton;
- Input, Textarea, Select, SearchField;
- Checkbox, Radio, Switch;
- Card and Surface;
- Badge and StatusBadge;
- Tabs;
- EmptyState;
- Skeleton;
- Alert and InlineMessage;
- Modal and Drawer;
- Toast;
- Tooltip;
- Breadcrumb;
- Pagination;
- FilterBar;
- ConfirmDialog;
- responsive Table/DataTable building blocks;
- mobile action sheet;
- PageHeader and SectionHeader;
- accessible loading and error states.

App-specific workflows remain in their own app and compose these primitives.

### 4.3 Accessibility contract

Shared components must support:

- visible keyboard focus;
- sensible tab order;
- accessible names for icon-only controls;
- semantic headings;
- modal focus trapping and return;
- reduced-motion preference;
- form validation that is not color-only;
- sufficient contrast;
- minimum practical touch targets on mobile.

### 4.4 Shared visual contract

Across all four apps:

- one primary button style per surface;
- consistent destructive-action treatment;
- consistent loading/error/empty states;
- consistent form spacing and validation;
- consistent status semantics;
- consistent modal/drawer behavior;
- consistent page rhythm.

The contract does **not** require identical navigation or page density.

## 5. WWW Experience

### 5.1 Product promise

A visitor should quickly understand what Lajukan contains, find something relevant, judge whether it is trustworthy, and take the next action.

### 5.2 Primary flow

`Discover -> Search/Explore -> Evaluate -> Trust -> Act`

### 5.3 Homepage

The homepage prioritizes:

1. clear value proposition;
2. search/discovery entry point;
3. high-value categories;
4. relevant/local discovery;
5. trust signals;
6. clear path to create or manage an offering where appropriate.

Do not stack multiple equal-weight hero CTAs.

### 5.4 Search and Explore

Search should support clear category switching and filtering for the platform's supported domains such as products, services, businesses, needs, users, and references.

Requirements:

- mobile filter drawer;
- useful zero-result guidance;
- applied-filter visibility;
- removable filters;
- clear sorting;
- location/radius treatment that users can understand;
- consistent listing cards;
- loading skeletons;
- no fake result counts.

### 5.5 Detail surfaces

Public detail pages emphasize:

- identity of the offering;
- price or pricing state;
- location;
- seller/business identity;
- trust signals;
- essential description and attributes;
- primary CTA;
- relevant secondary CTA;
- related discovery below the main decision area.

SEO metadata and structured data must remain correct while presentation changes.

### 5.6 Responsive behavior

WWW is fully usable at 360, 390, 430 px widths and common tablet/desktop sizes. Primary actions must remain reachable without horizontal scrolling.

## 6. Usaha Experience

### 6.1 Product promise

When a merchant opens Usaha, the product answers: **"Apa yang perlu saya kerjakan sekarang?"**

### 6.2 Primary navigation

Primary navigation is organized around merchant jobs:

- Beranda
- Jualan
- Produk & HPP
- Stok & Belanja
- Uang
- Kanal Jual
- Laporan

Secondary business administration is grouped under **Pengaturan usaha**:

- Profil usaha
- Lokasi
- Operasional
- Tim
- Halaman pembeli
- Keamanan

### 6.3 Beranda

Beranda shows:

- exactly one highest-priority primary action;
- a short list of lower-priority next actions;
- only real durable indicators;
- no fake revenue, margin, readiness, or channel state.

Priority logic must remain pure/testable and permission-sensitive.

### 6.4 Produk & HPP

The default layer is product-first. HPP, ingredients, supplier detail, channel pricing, and deeper costing are progressively disclosed.

Users without costing permission must not load or receive actionable costing controls.

### 6.5 Stok & Belanja

Out-of-stock and low-stock items are ordered first. The main action is replenishment or stock correction, not analytics.

### 6.6 Uang

Daily money entry is primary. Settlement/reconciliation appears when relevant channels and durable data exist. Advanced financial reporting is secondary.

### 6.7 Kanal Jual

Channel setup shows readiness honestly. Price recommendations require both usable product price and durable HPP/costing data; missing values do not become `0` or a sample fallback.

## 7. CMS Experience

### 7.1 Product promise

CMS is an editorial operations workspace: users process content, moderation, taxonomy, and placement efficiently.

### 7.2 Information architecture

Recommended top-level areas:

- Dashboard
- Konten
- Moderasi
- Kategori / Sektor
- Banner & Placement
- Media
- Scheduled
- Draft
- Arsip
- Settings

Only areas supported by real backend capabilities should be surfaced.

### 7.3 Dashboard

The CMS dashboard prioritizes queues and deadlines, for example:

- content awaiting review;
- scheduled content approaching publish time;
- failed or incomplete items;
- banner/placement tasks requiring attention.

It is not a giant form containing every CMS domain.

### 7.4 Component boundaries

The current oversized CMS dashboard should be decomposed into focused units such as:

- `ContentWorkspace`
- `ContentTable`
- `ContentEditor`
- `ModerationQueue`
- `SectorManager`
- `BannerManager`
- `PublishPanel`

Each unit owns one responsibility and exposes explicit inputs/actions.

### 7.5 Editorial efficiency

Support fast repeated work through:

- filters that persist while navigating a queue where appropriate;
- clear draft/publish/archive status;
- predictable save/publish actions;
- confirmation for destructive actions;
- preview where backend/domain support exists;
- keyboard-friendly repeated moderation.

## 8. CRM Experience

### 8.1 Product promise

CRM is an operations command workspace where staff can identify what needs attention and complete follow-up quickly.

### 8.2 Information architecture

Recommended areas:

- Overview
- Leads / Pipeline
- Contacts / Users
- Conversations
- Transactions
- Support
- Disputes & Risk
- Listings / Moderation, only if CRM remains an owning surface
- Analytics
- Administration

### 8.3 Overview

The default view is task-oriented, for example:

- leads requiring follow-up;
- unread conversations;
- pending KYC/review work;
- disputes or high-risk cases;
- transactions requiring intervention.

KPIs support decisions but do not replace the task queue.

### 8.4 Customer 360

A user/contact detail surface should aggregate, where authorized and supported:

- identity/contact context;
- leads/deals;
- listings;
- orders/transactions;
- conversations;
- support tickets;
- trust/risk signals;
- recent activity;
- next follow-up.

This must respect service boundaries and permissions; the frontend must not create new cross-service data access by bypassing existing APIs.

### 8.5 Component boundaries

The large CRM command center should be decomposed by domain, with data fetching and mutation logic close to the owning feature rather than one all-purpose component.

Likely boundaries:

- `OperationsOverview`
- `PipelineWorkspace`
- `ContactWorkspace`
- `ConversationWorkspace`
- `TransactionWorkspace`
- `SupportWorkspace`
- `RiskWorkspace`
- `AnalyticsWorkspace`

## 9. Error, Loading, and Empty-State Behavior

All applications use explicit state handling.

### Loading

- layout-stable skeletons;
- no indefinite spinner when a meaningful skeleton can be shown;
- buttons show local pending state for mutations.

### Error

- explain what failed in user language;
- preserve entered data where possible;
- provide one useful recovery action;
- do not expose internal stack traces.

### Empty

- distinguish truly empty data from filtered-to-zero results;
- distinguish unavailable permissions from missing configuration;
- provide a single useful next action.

## 10. Performance

### WWW

- protect Core Web Vitals;
- avoid unnecessary client components;
- keep public pages SEO-compatible;
- use responsive image sizing;
- avoid large dashboard-style bundles on public routes.

### Usaha/CMS/CRM

- code-split heavy workspaces where practical;
- avoid loading data for hidden permission-gated sections;
- avoid giant components that force unrelated rerenders;
- paginate or virtualize large data sets when justified by observed volume.

## 11. Testing Strategy

### Shared UI

- unit/interaction tests for stateful primitives;
- accessibility assertions for critical primitives;
- contract tests where apps depend on shared behavior.

### WWW

- search/filter state;
- public detail primary CTA;
- no-result behavior;
- metadata/SEO regression tests;
- responsive production build.

### Usaha

- next-action priority tests;
- permission tests;
- no-fake-data tests;
- progressive-disclosure tests;
- Business OS gate, typecheck, and production build.

### CMS

- queue/filter behavior;
- editor save/publish/archive behavior;
- destructive confirmation;
- permission/auth behavior;
- typecheck/lint/build.

### CRM

- pipeline transitions;
- follow-up/task ordering;
- mutation permission boundaries;
- risk/dispute handling;
- data-empty and partial-failure behavior;
- typecheck/lint/build.

### Cross-app

At the final wave verify at minimum:

- 360 / 390 / 430 px mobile widths for WWW and Usaha;
- tablet layout;
- common desktop widths;
- keyboard navigation;
- focus visibility;
- long Indonesian text;
- zero data;
- partial data;
- large data lists;
- loading/error states;
- role restrictions;
- shared UI package build;
- lint/typecheck/test/build all four apps.

## 12. Delivery and Branching

The redesign is delivered as small, ordered PRs rather than one giant PR.

Suggested sequence:

1. `feat/ui-foundation-*`
2. `feat/www-experience-*`
3. `feat/usaha-experience-*`
4. `feat/cms-editorial-workspace-*`
5. `feat/crm-operations-workspace-*`
6. `chore/frontend-cross-app-qa-*`

Each PR should:

- start from current `main`;
- preserve external API contracts unless separately designed;
- use TDD for behavior changes;
- pass its app-specific gates;
- pass shared frontend quality gates where affected;
- contain no temporary workflow when merged.

## 13. Non-Goals

This redesign does not automatically include:

- new backend domains solely to make a UI mockup look complete;
- fake analytics or demo production data;
- wholesale brand replacement;
- rewriting all frontend code into a new framework;
- changing service ownership boundaries;
- adding features without a validated user job;
- making CMS/CRM mobile-first at the expense of operator efficiency.

## 14. Definition of Done

The cross-app redesign is complete when:

1. shared tokens and primitives are the canonical visual foundation;
2. WWW clearly supports discovery -> trust -> action;
3. Usaha clearly supports daily merchant next actions;
4. CMS is decomposed into editorial workspaces and queue-oriented workflows;
5. CRM is decomposed into operational workspaces and task-oriented workflows;
6. no app uses known fake fallback business data for readiness, revenue, price, margin, or status;
7. permission-sensitive actions are hidden/disabled according to authorization contracts;
8. loading, error, empty, and destructive states use consistent patterns;
9. responsive and accessibility checks pass;
10. lint, typecheck, tests, production builds, and relevant runtime gates are green on the final `main`;
11. temporary helper workflows and superseded redesign branches are removed after merge.
