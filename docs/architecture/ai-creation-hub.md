# AI Creation Hub

Status: phase 1 implemented 2026-07-14.

## Purpose

Profile AI can prepare structured, user-owned drafts and hand them to canonical create flows. AI never publishes a listing or business profile directly.

Phase 1 targets:

- `offering_listing`
- `looking_for_listing`
- `business_profile`

Community posts, reels, opportunities, and jobs remain reserved creation targets until their canonical create adapters are implemented.

## Ownership And Service Boundary

- `marketplace_service` owns `creation_drafts` and `creation_draft_versions`.
- `frontend/www` exposes authenticated BFF routes under `/api/creation-drafts/*`.
- Every service query includes both the random draft ID and authenticated `owner_id`.
- Draft IDs are non-sequential `drf_<uuid-simple>` values.
- Drafts expire after 30 days and can be `ready`, `editing`, `consumed`, `expired`, or `discarded`.

## Flow

1. The user chats or uploads private media in Profile AI.
2. The user chooses Offer, Request, or Business Profile. This starts a guided creation state; it does not create a draft yet.
3. Profile AI asks for target-specific labeled facts. Partial answers, media references, missing fields, and progress are stored in assistant-message metadata so the flow survives reloads.
4. When the minimum factual fields are present, AI summarizes only the supplied facts. A generic creation intent or an unanswered form must remain in `collecting` state.
5. The BFF validates the target, rate-limits generation, and promotes owned private images to controlled content storage.
6. Local structured rules create a safe fallback and prioritize explicit labeled values such as product name, requested item, or business name. Optional Ollama may improve title and summary using only existing conversation facts.
7. The marketplace service stores the payload, media references, confidence metadata, warnings, missing fields, and version 1.
8. Profile AI stores the draft reference in assistant-message metadata and renders `AICreationCard` only after readiness validation succeeds.
9. The continue URL contains only the random draft ID.
10. The canonical listing or business flow fetches the owner-scoped draft and maps it into its existing form.
11. The regular publish/create endpoint validates the resource. Only after success is the creation draft marked `consumed`.

## Conversation Context

- Reply targets are validated against the owner-scoped thread. The quoted excerpt is stored as message metadata and included in later AI history.
- Reactions are owner-scoped message metadata and do not alter business facts.
- Forwarding copies a message into another owner-scoped Personal AI thread with source metadata. It never forwards a linked creation draft or changes draft ownership.
- Cancelling a guided creation state must stop automatic draft creation while leaving the normal chat available.

## Safety Rules

- No phone, address payload, image base64, or AI conversation is placed in the continue URL.
- Plain location text never becomes coordinates. Users must select a structured autocomplete result before publishing.
- Inferred taxonomy and other uncertain fields are marked for confirmation.
- External media URLs are rejected. Profile AI media must belong to the authenticated user.
- AI cannot invent supplier identity, price, exact location, certification, verification, stock, or guarantees.
- A statement of intent such as "I want to create an offer" is not sufficient factual input and must never produce a draft card by itself.
- Draft history is append-only by version; original conversation and media references remain attributable.
