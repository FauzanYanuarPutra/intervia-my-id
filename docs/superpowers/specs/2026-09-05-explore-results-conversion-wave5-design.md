# Explore Results Conversion Wave 5 Design

## Goal
Turn Explore result pages into a clearer path from discovery to action without changing marketplace APIs, authentication, payments, or backend ranking.

## Scope
Wave 5 improves four public frontend layers: result-card trust hierarchy, result actions, zero-result recovery, and conversion analytics. It applies to product/service listings, businesses, buyer needs, and people where the existing payload already exposes enough information.

## Principles
- Preserve the existing search API and ranking order.
- Never imply verification that the payload does not provide.
- Keep detail/profile pages as the primary destination; chat is only surfaced when an existing safe route is available.
- Make zero-result states useful instead of terminal.
- Keep public reference data visually and semantically separate from transactional listings.
- Indonesian and English copy must remain aligned.

## Result cards
Product and service cards should make three questions answerable at a glance: what is offered, by whom, and where. Verified state is a trust signal, not a ranking claim. The primary interaction remains opening the listing detail. A compact action label such as “Lihat detail” may be shown to make the click target explicit without inventing a direct-chat route.

Business cards should show business type, verified state when present, location, and an explicit “Lihat profil” action. Need cards should emphasize that the item is a buyer request and use an action such as “Lihat kebutuhan”. User cards retain profile navigation and should not fabricate availability or verification.

## Zero-result recovery
For marketplace result tabs, zero results should offer three recovery paths when relevant:
1. broaden the search by returning to Explore;
2. browse a canonical category/result surface;
3. create the opposite-side intent: supply searches may post a need, demand searches may post an offer.

References remain special: they use source/license-aware recovery and do not show transactional creation language.

## Trust hierarchy
Trust presentation is conservative:
- `verified === true` may render a verified badge and text label;
- owner/business name and location are factual context;
- no inferred ratings, response times, stock, seller quality, or ranking labels;
- public references keep their existing provenance warning and source/license links.

## Analytics
Track explicit zero-result recovery actions and result-card primary actions with stable action names. Do not emit private content or user identifiers in analytics properties.

## Testing
Add pure helpers for card action labels and zero-result recovery configuration so behavior can be tested without coupling tests to visual markup. Component integration consumes those helpers. Local lint/test/build remains required before claiming green status.
