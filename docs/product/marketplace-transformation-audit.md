# Marketplace Transformation Audit

Status: implementation audit 2026-07-26.

This document translates the approved transformation direction into an evidence-based delivery program. It does not claim that the whole roadmap is already implemented.

## A. Business Assessment

- Business model: two-sided business-needs marketplace supported by discovery, demand posts, supplier offers, profiles, chat, community distribution, and transaction primitives.
- Market structure: liquidity must be built per category and region; broad feature count is not a substitute for qualified supply and demand.
- Initial segments: Indonesian MSME buyers, suppliers, producers, service providers, distributors, and local business operators.
- Core liquidity risk: thin supply or demand in a category/location creates zero results, slow responses, and low repeat use.
- Monetization order: supplier productivity and verification services first; transaction fees only after payment operations are verified end to end.
- Export opportunity: readiness profiles, buyer requests, capability statements, and sample workflows should precede cross-border settlement.
- Principal risks: false trust claims, synthetic activity, unscoped private data, inconsistent taxonomy/location, weak moderation, and payment readiness that is not operationally proven.

## B. Product Audit

Verified canonical surfaces:

- Discovery: `/explore`, `/content/[id]`, `/toko/[slug]`, public profiles.
- Supply and demand creation: `/create` and `/create/[flow]`.
- Owned demand workspace: `/my-projects`.
- Communication: internal chat and separate WhatsApp contact behavior.
- Distribution: community and reels, which remain engagement layers.

P0 findings in the implemented slice:

1. `/my-projects` showed fictional requests before the API completed or when it failed.
2. Project views, profile visits, saves, chat leads, and deal readiness were generated from a deterministic string seed.
3. `/v1/lajukan/requests` returned all active requests without an authenticated owner filter.
4. Offer details were included in public request responses.
5. The WWW request BFF did not forward the access token.
6. The create landing showed unverified user, post, interaction, and response statistics.
7. Several public copy surfaces implied secure payment or escrow readiness beyond verified operational evidence.
8. Community and reels had public page metadata and public GET behavior but were marked authenticated in the route catalog.
9. Public profile, listing detail, and UMKM discovery depended on hydration for primary reader content.
10. Listing detail returned a visual not-found state inside a successful page and the marketplace detail endpoint exposed inactive rows publicly.
11. The legacy search client carried a Bandung fallback that could conflict with account, query, or viewer location.

## C. Economic Logic

- North Star: qualified business matches per month.
- Primary inputs: active buyers, active suppliers, requests published, first response time, quotes submitted, and repeat matches.
- Liquidity guardrails: zero-result rate, requests without offers, supplier response rate, median time to first response, and category/location concentration.
- Trust guardrails: report rate, verified-interaction review rate, misleading badge incidents, and private-data exposure.
- Pricing logic: preserve currency, unit, MOQ, validity, tax/shipping inclusion, and negotiation mode; never present estimates as fixed prices.
- Network effect: optimize for relevant responses and completed business follow-up, not raw registrations or synthetic activity.

## D. Technical Architecture

- Identity service owns users, authentication, organizations, memberships, roles, and verification identity state.
- Marketplace service owns listings, needs, RFQs, quotes, matches, prices, locations, orders, and trade data.
- Community service owns posts, comments, groups, and reels metadata.
- Chat service owns conversations, messages, presence, and read state.
- WWW API routes remain BFF/proxy surfaces and must forward authentication without exposing internal URLs.
- Cross-service profile synchronization uses outbox/inbox events with idempotency. RabbitMQ is the durable transport; Redis is for cache/ephemeral coordination, not the source of truth.
- Search remains multi-source and must keep taxonomy, database metadata, and index fields aligned.

Current request workspace contract:

1. Browser requests `/api/lajukan/requests?mine=true`.
2. WWW forwards the bearer/access token.
3. Marketplace validates the JWT and derives the actor user ID.
4. SQL filters `content_items.owner_id` using the authenticated actor.
5. Owner mode may include offer previews; public mode omits offer details.
6. UI renders loading, service error, empty, or persisted project data without demo fallback.

## E. Implementation

### Owned Project Integrity

- Problem: fictional projects and generated activity appeared as user data.
- Business impact: destroys trust in demand liquidity and corrupts operating decisions.
- User impact: users could see projects, vendor offers, and performance values they never created.
- Cause: client fallback constants, deterministic analytics functions, public unscoped backend query, and missing token forwarding.
- Solution: authenticated owner filtering, private offer-detail behavior, honest UI states, and persisted-count-only summaries.
- Services: WWW and marketplace service.
- Database migration: none; existing indexed `content_items.owner_id` is used.
- API contract: additive `mine=true`; public response shape remains compatible while offer arrays are empty outside owner mode.
- Risk: existing clients that depended on public offer previews will no longer receive private offer details.
- Before: API failure looked like successful sample data.
- After: API failure is an actionable retry state; no data is shown as real unless returned by the service.

### Public Claim Hygiene

- Problem: unverified scale metrics and secure-payment language appeared on public surfaces.
- Business impact: creates legal, trust, and conversion risk when users discover capability gaps.
- User impact: users can form incorrect expectations about platform scale and payment protection.
- Cause: static marketing numbers and copy that was not tied to a readiness flag or verified dataset.
- Solution: replace statistics with concrete workflow value and qualify payment availability.
- Database migration: none.
- API contract: none.

### Public Read And Server Rendering

- Problem: public discovery routes either redirected guests or exposed only loading placeholders in initial HTML.
- Business impact: weak indexability, broken shared links, and lower trust for users opening Community, Reels, profiles, listings, or UMKM pages from search/social channels.
- User impact: guests could not read Community/Reels and profile followers, avatars, listing owners, or UMKM results arrived late after hydration.
- Cause: authenticated route flags and browser-only initial fetches.
- Solution: public read route flags with write actions still gated, server profile resolution with social summary, server-validated listing data, a semantic home loading shell, and initial UMKM store data.
- Services: WWW, identity service public API, community service public social API, and marketplace service.
- Database migration: none.
- API contract: existing public GET contracts are reused.

### Dead Listing Status

- Problem: draft or inactive listing detail remained fetchable and missing listings rendered an HTTP 200 client empty state.
- Business impact: stale or private inventory could stay indexable and confuse marketplace liquidity.
- User impact: dead links looked like broken application state instead of a real not-found page.
- Cause: marketplace detail had no content-status access rule and Next.js could not call `notFound()` from the client page.
- Solution: active-or-owner authorization in marketplace service plus a server page wrapper that returns Next.js 404 for missing or inactive public content.
- Sitemap impact: the existing sitemap remains active-only; no duplicate sitemap source was added.

### Location Consistency

- Problem: a legacy search surface used Bandung as a fallback even when no explicit location was selected.
- Impact: location labels could disagree with account or business-summary location.
- Solution: no city is inferred from a hardcoded fallback; the neutral label is `Semua lokasi` / `All locations`.

## F. Test Report

Required validation for this slice:

- Frontend unit: project activity summary uses only supplied request and offer values.
- Frontend lint/type/build: targeted files first, then the WWW build when practical.
- Rust unit: public/owner request filter behavior.
- Rust format/check/test: marketplace service targeted tests.
- Contract review: `mine=true` returns 401 without authentication and scopes by `owner_id` with authentication.
- Frontend route contract: Community, group detail, Reels, reel detail, and public profiles resolve as shared routes.
- Frontend type/build: server/client boundaries for profile, listing, home, and UMKM.
- Rust detail contract: active content is public; inactive content is hidden from guests and remains available to its owner.

Runtime, E2E, accessibility, Lighthouse, load, and search relevance remain separate validation work. They must not be reported as passed until executed against a running stack.

## G. KPI Framework

- North Star: qualified business matches per month.
- Demand inputs: needs published, needs receiving at least one quote, median first response time, repeat buyers.
- Supply inputs: active suppliers, response rate, qualified quote rate, repeat suppliers.
- Discovery: search success, result click-through, zero-result rate, listing-to-profile, profile-to-contact.
- Guardrails: reports, spam, misleading claims, unauthorized access, support burden, and payment disputes.
- Revenue: active paid suppliers, revenue per active business, contribution margin, acquisition payback.
- Export readiness: completed assessments, profiles ready for inquiry, verified buyer requests, sample requests, and qualified international conversations.

## H. Roadmap

### 30 Days

- Finish P0 claim, dead-page status, location, empty-state, security, and SSR audits.
- Add contract tests for owner-scoped project requests.
- Define measured project analytics queries from canonical events.
- Inventory remaining fictional/static runtime datasets.

### 90 Days

- Stabilize domestic search/create/profile/RFQ/quote comparison.
- Add marketplace liquidity dashboard by category and region.
- Complete moderation ownership and high-intent connection tracking.
- Improve supplier onboarding in the launch cluster.

### 6 Months

- Organization memberships, team roles, verification tiers, saved searches, and supplier analytics.
- National taxonomy and regional marketplace health.
- Versioned explainable matching with admin review.

### 12 Months

- Export profiles, readiness assessment, buyer requests, capability statements, sample workflows, and trade-document checklist.
- Multi-language and safe multi-currency display.

### 24 Months

- Evaluate cross-border payment, settlement, inspection, shipment, dispute, and compliance only after readiness review.

## I. Remaining Risks

- Production payment, refund, and escrow operations are not yet proven end to end.
- Detailed project view/profile/chat analytics are not yet backed by reviewed aggregate queries.
- Supplier and buyer density is not yet established for every category and region.
- Runtime HTTP verification is still needed after deployment for profile/listing/UMKM HTML and stale production URLs.
- Legal, export, sanction, restricted-product, and cross-border wording still requires professional review.
- Full moderation coverage across listings, chat, community, and reels remains incomplete.
- Meilisearch synchronization recovery and chat realtime behavior still need runtime evidence.
