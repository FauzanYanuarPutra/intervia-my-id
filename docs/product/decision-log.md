# Decision Log

Status: repo audit 2026-07-11.

Use this file for approved product/architecture decisions. Do not record unapproved ideas as decisions.

## 2026-07-11: Documentation Source Of Truth

- Decision: Root `AGENTS.md` and `docs/*` become the agent/engineering knowledge base.
- Evidence: User requested documentation-only audit; repo has multiple services and older docs.
- Consequence: Future product changes should update relevant docs when meaning changes.

## 2026-07-11: Do Not Treat Community/Reels As Transaction Categories

- Decision: Community and reels are engagement/distribution layers.
- Evidence: Code places them in `community_service` with forum/reel/group schemas and public routes, not marketplace category tables.
- Consequence: Navigation can promote them, but category taxonomy should not put them beside Mesin & Alat/Bahan Usaha as direct transaction needs.

## 2026-07-11: Chat And WhatsApp Stay Separate

- Decision: Internal chat and WhatsApp must be audited and maintained as separate channels.
- Evidence: Chat service has dedicated room/message APIs; WhatsApp helper/webhook/contact links exist separately.
- Consequence: Removing either channel needs explicit product approval.

## Pending Decisions

- Canonical owner surface: `frontend/usaha` vs `/usaha/*` in `frontend/www`.
- Public wording for payments/escrow/refunds until E2E production verification.
- Canonical taxonomy registry location.
- Required moderation coverage for community/reels/listings/chat.

## 2026-07-23: Create Starts Brief-First

- Decision: `/create` opens the brief-first simple create flow for new posts. The longer draft wizard remains for existing draft continuation and detail routes.
- Evidence: Product input identified the long create form as a major friction point; existing product principles already require publishing a need or offer without complex forms.
- Consequence: New create sessions should ask only for required fields first, keep optional detail collapsed, and avoid making exact map pins or supporting documents feel mandatory unless backend publish policy requires them.

## 2026-07-23: Create Layout Stays Focused

- Decision: Create pages should not show the old multi-section desktop sidebar (`Mulai`, `Usaha`, `Kelola`) or expose all 9 schema steps as the primary progress UI. The visible create progress is three phases: choose, fill, review.
- Evidence: Product input found the sidebar and 9-step progress overwhelming, especially around the `Jenis` step.
- Consequence: Keep create focused on the active task. Subcategory remains the required taxonomy choice; industry is optional in the UI and uses a backend-compatible fallback when omitted.

## 2026-07-23: Visible Seed Data Uses Real Public Indonesia Sources

- Decision: New visible seed data must prefer real Indonesia open/public references and free/public media. Fictional seller-like demo rows should be hidden from primary discovery when a real seed pack is available.
- Evidence: Product input explicitly requested real Indonesian seed data with free web images/videos and no fake business data.
- Consequence: Seed rows must store source/license/provenance metadata, avoid private phone/WhatsApp data unless consent is explicit, and label reference-only rows as non-transactional.
- Implementation note: Bulk provider imports may use OpenStreetMap/Overpass or Geofabrik OSM extracts with ODbL attribution. Bulk buyer imports may use public RUP/SiRUP references as `request` rows, but they remain source-only demand references and must not create CRM leads or auto-connections.
- Image note: Google images must not be scraped. Provider photo enrichment may use Google Places API only when an API key is configured, store `place_id`/proxy references instead of raw photo names or downloaded files, and display Google Maps attribution.

## 2026-07-26: Owned Project Workspaces Must Not Use Synthetic Activity

- Decision: `/my-projects` only loads request posts owned by the authenticated user. Runtime demo requests and deterministic view/profile/chat/readiness calculations are not valid fallbacks.
- Evidence: The previous client used `LAJUKAN_SAMPLE_REQUESTS` whenever the request API had not returned data and generated activity values from a string seed. The marketplace request endpoint also returned all active requests without an owner filter.
- Consequence: The BFF forwards the access token, requests use `mine=true`, marketplace filtering is enforced by authenticated `owner_id`, public mode omits offer details, and the UI uses explicit loading/error/empty states. Only persisted request, status, and offer counts may appear until measured event aggregates are implemented.

## 2026-07-19: Explore Is The Single Public Discovery Surface

- Decision: `/explore` is the only public destination for browsing and searching. With no result parameters it shows category discovery; with a query or filter it renders the shared search results experience. The earlier Search/Explore presentation split is superseded.
- Evidence: Product review found that two adjacent destinations with overlapping categories, filters, and results increased navigation and terminology overhead for Indonesian users.
- Consequence: Public links, navigation, SEO search actions, and legacy route mappings target `/explore`. `/search` remains only as a permanent compatibility redirect that preserves query parameters. `/api/search` and the shared search data/components remain the canonical backend and implementation primitives.

## 2026-07-17: Blog Uses Marketplace Content Pipeline

- Decision: Public blog pages use `content_items` with `content_type` `article` or `news` as the backend/database source, with static SEO articles kept only as fallback.
- Evidence: The marketplace schema already allows `article` and `news`, `/v1/content` already supports type/status filtering, and the public `/blog` routes already existed with static localized article data.
- Consequence: Do not create a duplicate blog table/service yet. Blog authoring should feed marketplace content metadata, while WWW exposes `/api/blog` and `/api/blog/[slug]` as the public BFF contract.

## 2026-07-11: Refactor Must Be Plan-First And Evidence-Based

- Decision: Structural refactor work starts from `docs/engineering/refactor-plan.md`, `docs/security/security-review.md`, and `docs/performance/baseline.md`.
- Evidence: Repository has a large dirty worktree and several very large product-critical files.
- Consequence: Large module splits, search pipeline changes, payment semantics, and chat storage changes require tests/ADR before implementation.

## 2026-07-11: CRM Evolves Additively Before Service Split

- Decision: Current CRM remains in marketplace service near-term while the product evolves toward owner CRM plus internal CRM workspaces.
- Evidence: `frontend/crm`, WWW `/api/crm/*` routes, marketplace `/v1/crm/*` routes, and `crm_leads`/`crm_activities` already exist. Product input requires a simple UMKM-facing CRM, not a heavy corporate CRM.
- Consequence: Build contacts, tasks, quotes, workspace/business scoping, and owner-friendly UI additively first. A standalone `crm_service` requires a later ADR and migration plan.

## 2026-07-11: CRM Priority Clarified To Internal Lajukan Match

- Decision: The next CRM direction is internal Lajukan operations around `Pencari -> Kebutuhan -> Penyedia sesuai -> Terhubung -> Berhasil/Gagal`, with `Lajukan Match` as the core matching workflow. Seller-owned CRM/pipeline features are deferred until the internal matching and connection lifecycle is proven.
- Evidence: Latest product instruction explicitly rejects a traditional seller CRM as the next priority. Repository evidence shows current CRM is already internal/ops-oriented (`frontend/crm`, marketplace `/v1/crm/*`, `crm_leads`, `crm_activities`) and marketplace already has request/listing primitives that can be reused for needs and providers.
- Consequence: New CRM work should add requirement review, AI extraction, candidate matching, admin approval, connection tracking, feedback, analytics, and audit logs. Passive search/view/click signals should stay analytics unless an explicit high-intent action creates a reviewed requirement or connection.

## 2026-07-11: Cluster-First Product Strategy

- Decision: Lajukan should prioritize a dense regional business-needs cluster before broad national marketplace expansion.
- Evidence: Product input emphasizes Indonesia's geography, local trust, WhatsApp behavior, and serviceability needs for machines, tools, materials, services, and places. Existing product docs already identify search, location, WhatsApp, trust, and `Mencari/Menawarkan` as core product primitives.
- Consequence: New discovery, ranking, onboarding, and analytics work should improve regional supply-demand density first. `Usaha Sekitar` should be treated as a location capability across categories, and `Mencari` demand data should be treated as a first-class asset for matching and supplier acquisition.

## 2026-07-12: Personal AI Evolves Into Configurable AI Mini-App Builder

- Decision: `/profile/ai` is the canonical MVP surface for user-created AI mini-apps. Creators can configure steps, input fields, hidden instructions, quick actions, output sections, model policy, media support, and visibility without custom code.
- Evidence: Product input asks for a Lajukan-native version of a wizard prompt generator where users can create private or public tools. Existing `personal_ai_agents.builder_config` already stores declarative JSON configuration and Personal AI already supports media, model routing, and private owner data.
- Consequence: Keep the builder declarative and component-based for security. Visibility starts as `private`, `unlisted`, and `public`; public discovery/profile surfacing can be added later on top of the same canonical builder instead of creating a duplicate AI Tools flow.

## 2026-07-13: Supply-First Marketplace Entry Points

- Decision: Home, search, and simple create should default to `Bahan & Supplier` first, then `Jasa`, then `Mesin & Alat`, then `Tempat Usaha`. Machines/tools stay a core category but should be positioned as a technical/production need, not the default first mental model.
- Evidence: Product input challenged the over-focus on machines/tools and asked to inspect available supply first. Local marketplace `content_items` on 2026-07-13 showed active `supplies` listings/requests ahead of `equipment` in `metadata.create_category` (`supplies`: 6 active, `equipment`: 4 active) and active supply side (`supplies`: 5, `equipment`: 3).
- Consequence: Category registries and UI surfaces should be supply-chain-first by default. Regional campaigns can override ranking only with explicit demand/supply evidence.

## 2026-07-13: Five-Category Marketplace Taxonomy

- Decision: Marketplace search/create uses five transaction categories with canonical slugs: `materials-suppliers`, `services`, `machines-tools`, `business-places`, and `business-opportunities`.
- Evidence: Product instruction required separating marketplace taxonomy from community/video/profile/chat modules and distinguishing category, subcategory, industry, listing type, and filters. Existing code already had partial legacy IDs (`supplies`, `service`, `equipment`, `property`, `opportunity`) and `Usaha Sekitar` as a location capability.
- Consequence: Legacy IDs remain as aliases, `Usaha Sekitar` stays outside transaction taxonomy, and normalized taxonomy tables/backfills become the source for category, subcategory, industry, filter, and suggestion APIs.

## 2026-07-13: Draft-First Schema-Driven Create Flow

- Decision: Listing creation uses a 9-step draft-first wizard backed by the canonical marketplace taxonomy and intent-specific schemas for `offer` and `request`.
- Evidence: Product instruction required a full create-flow redesign, not a cosmetic patch, with temporary local drafts from the first step, server drafts after category/subcategory/industry selection, autosave, media, location, contact, and review/publish.
- Consequence: Create and edit should share the same schema definitions over time. Draft lifecycle fields live additively on `content_items`; public discovery should continue to use published/active listings, while incomplete drafts remain private to their owner.

## 2026-07-14: Profile AI Uses One Owner-Scoped Creation Draft Bridge

- Decision: Profile AI creates structured `creation_drafts` and hands only a random draft ID to canonical create flows. Phase 1 supports offers, requests, and business profiles; AI never publishes automatically.
- Evidence: Product instruction requires a universal AI Creation Hub, secure media reuse, preview cards, field confidence, and draft-first continuation. Existing Profile AI, private media upload, listing autosave, and business onboarding can be extended without duplicating those surfaces.
- Consequence: `marketplace_service` owns creation draft lifecycle and version history. WWW remains the authenticated BFF and adapter layer. Plain location text must still be confirmed through structured location autocomplete, publish endpoints retain final validation, and later community/reel adapters must reuse this draft contract instead of creating separate AI draft stores.

## 2026-07-14: Category Explore Reuses Canonical Search

- Decision: `/explore/[category]` remains the contextual and indexable category URL used by home, but its results, cards, grid, filters, pagination, and URL state are rendered by the canonical search client.
- Evidence: Product input identified inconsistent cards and grids between category explore and `/search`, while the repository had two independent result-fetching clients for the same marketplace data.
- Consequence: Category and subcategory are first-class search parameters. Home, explore, search, and create reuse the same canonical category slugs and taxonomy fallback; new category result behavior must be implemented in search rather than duplicated under explore.

## 2026-07-14: Search Utility And Explore Destination Split

- Decision: The latest approved direction supersedes the presentation model above. Global Search is a multi-source utility with semantic result tabs, while `/explore` and `/explore/[category]` are indexable navigation destinations with category-specific sections, guides, and discovery context. Both surfaces continue sharing the canonical taxonomy, normalized API adapters, and result-card primitives.
- Evidence: Product instruction explicitly separates searching for a known need from browsing categories, while requiring consistent data, filters, cards, URLs, desktop navigation, and mobile navigation across both journeys.
- Consequence: Search is omitted from primary navigation and marked `noindex, follow`; Explore owns category navigation and canonical category URLs. Community and Video may appear as Explore channels, but remain engagement/distribution modules rather than marketplace transaction categories. Legacy category/search URLs must redirect or migrate their parameters without breaking saved links.

## 2026-07-14: Profile AI Uses Guided Creation Before Draft Generation

- Decision: Offer, request, and business-profile actions in `/profile/ai` start an owner-scoped guided creation state. Profile AI collects target-specific labeled facts across messages and creates an `AICreationCard` only after the minimum factual fields are present.
- Evidence: Product input rejected draft cards generated from a generic intent sentence and requested chat-native form collection, contextual AI behavior, reply, reactions, and forwarding. The existing Personal AI message metadata and creation-draft bridge can support this without adding a duplicate creation flow.
- Consequence: Generic creation intent remains `collecting`; partial answers and media survive reloads; cancellation prevents draft creation. Reply and forwarded-message context is included in AI history, while reactions remain interaction metadata. AI still cannot publish automatically or invent missing business facts.
