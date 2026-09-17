# WWW Interaction & Responsive System Overhaul

Date: 2026-09-17
Scope: `frontend/apps/www`

## Goal

Make Lajukan WWW feel like one coherent product across Reels, Community, Explore, UMKM, and shared application surfaces. The work improves visible interaction state, responsive behavior, loading/error/empty handling, accessibility, and interaction hierarchy without replacing domain logic or inventing unsupported backend state.

## Product Principles

1. **State must be visible.** If the backend/client knows something is liked, saved, followed, joined, pending, selected, disabled, loading, or failed, the UI must show that state consistently.
2. **Primary actions stay obvious; secondary actions stay quiet.** Avoid crowded toolbars. Put infrequent actions in menus/sheets while preserving fast access to high-frequency actions.
3. **Optimistic UI with rollback.** Existing optimistic actions should remain immediate but clearly expose loading and revert cleanly on failure.
4. **Responsive by behavior, not just width.** Mobile uses focused single-column or bottom-sheet patterns; tablet uses wider content without artificial narrow caps; desktop may add sidebars/panels when useful.
5. **Do not invent business facts.** Do not render statuses such as “open now,” verified, stock availability, membership, or ownership unless the app already has reliable data for them.
6. **Accessible interaction semantics.** Interactive controls use `aria-pressed`, `aria-current`, meaningful labels, keyboard focus, reduced motion compatibility, minimum comfortable hit areas, and disabled/busy semantics.

## Shared Interaction State Model

Create or consolidate shared visual conventions for:

- `active` / `selected`
- `liked`
- `saved`
- `followed`
- `joined`
- `pending`
- `owned` / `managed`
- `loading` / `busy`
- `disabled`
- `error`

Conventions:

- Active/pressed state changes at least two cues where practical: fill/color plus surface/ring/text.
- Loading keeps geometry stable and uses a spinner or progress affordance without layout shift.
- Disabled controls remain readable but clearly inactive.
- Error states provide a retry path where the action is recoverable.
- Selected filters/tabs are visibly stronger than hover-only controls.

## Reels

Keep the existing full-screen, snap-based player and current action/backend logic. Improve presentation and consistency rather than rebuilding the feature.

### Interaction behavior

- Like: distinct inactive vs active heart; active is filled/rose and uses `aria-pressed`.
- Save: distinct inactive vs saved state; active uses filled/high-contrast bookmark treatment.
- Follow: explicit not-following / loading / following states; prevent ambiguous `+` state after success.
- Share/comments/product/store: visible busy/disabled behavior when applicable.
- Preserve current optimistic update + rollback and server-loaded action state.
- Keep `Not interested` and “Why this Reel?” secondary controls available through the action/menu hierarchy.
- Keep watch/preference learning and current event tracking unchanged.

### Responsive behavior

- Mobile: edge-to-edge video, condensed top bar/action rail/caption, safe-area aware.
- Small phones: avoid caption/action overlap and clipped bottom content.
- Tablet: allow the viewing surface to use more of the screen instead of forcing an early narrow desktop cap.
- Desktop: retain useful left navigation and optional contextual right panel only when screen width supports it.
- Overlays: bottom sheets on phone, centered or side panels at larger breakpoints.

### Player states

Differentiate buffering, paused-by-user, playback error, empty feed, load-more, and end-of-feed states.

## Community

Keep the current forum/feed APIs, optimistic like behavior, poll handling, moderation/report flows, and composer logic.

### Feed interaction

- Standardize Like visual semantics with visible pressed state and rollback behavior.
- Keep comment/reply/share subordinate to the primary reaction action.
- Make post cards stable across narrow and wide screens.
- Distinguish loading, empty, search-empty, and fetch-error states.
- Prevent long names/tags/media from forcing horizontal overflow.

### Groups

Where data supports it, visually distinguish:

- Join
- Pending request
- Joined
- Managed/owned

Do not infer membership states from unrelated metadata.

### Polls and composer

- Selected poll option must remain visible after voting.
- Results should not visually erase the user’s own choice.
- Composer modal is a full-height mobile surface and bounded desktop dialog.
- Publishing/uploading keeps controls stable and exposes progress/busy state.

## Explore

Explore routes remain orchestration boundaries. UI changes belong mainly in `ExploreHubPage`, search clients, category/result cards, and visual-system components.

### Hub

- Stronger selected state for supply vs demand intent.
- Search field and submit button remain compact but easier to scan.
- Category cards use consistent active/hover/focus behavior.
- Horizontal category rails remain swipe-friendly on mobile and easier to browse on desktop.
- Remove layout choices that create avoidable empty space at intermediate widths.

### Search/results

- Search tabs and filters expose a clear active state.
- Distinguish loading, empty results, partial results, and error with retry.
- Result count/filter context should remain visible without overwhelming the page.
- Cards use consistent badges/actions and do not visually claim unsupported status.

## UMKM Discovery

Preserve current map/list data flow, public/reference distinction, deep-linking, and route semantics.

- Clear selected category and city filter state.
- Clear selected business/result state across map and list.
- Mobile controls remain reachable above map content and safe areas.
- Desktop uses available horizontal room for results/detail instead of oversized floating controls.
- Search reset/clear behavior is explicit.
- Loading, no results, public reference, registered store, and fetch error are visually distinct.
- Do not add “open now,” verification, live stock, or rating claims unless reliable fields already exist.

## Global WWW Pass

Apply conventions to shared surfaces touched by these flows and reusable layout primitives:

- minimum practical touch target around 40–44px for primary interactive controls
- consistent `focus-visible` treatment
- active/pressed styling
- disabled and loading styling
- safe-area padding
- mobile bottom navigation/sticky header coexistence
- no horizontal overflow at ~320px width
- sane content width on tablet and desktop
- responsive typography and truncation
- skeletons that resemble final layout
- empty/error/retry patterns
- bottom sheet vs desktop dialog behavior
- dark-mode parity
- reduced-motion friendly transitions

## Architecture

Prefer targeted shared primitives/utilities over a full design-system rewrite. Existing domain components keep their responsibilities.

Likely touch points include:

- `frontend/apps/www/src/app/[locale]/(shared)/reels/ReelsClient.tsx`
- `frontend/apps/www/src/components/community/CommunityFeedClient.tsx`
- `frontend/apps/www/src/components/explore/ExploreHubPage.tsx`
- `frontend/apps/www/src/components/explore/ExploreAllSearchClient.tsx`
- `frontend/apps/www/src/components/explore/ExploreVisualSystem.tsx`
- `frontend/apps/www/src/components/super-app/UmkmDiscoveryClient.tsx`
- `frontend/apps/www/src/components/super-app/UmkmDiscoveryPanel.tsx`
- small shared UI helpers only where they reduce duplication and improve consistency

Avoid broad unrelated refactors.

## Testing & Verification

Add focused regression tests where behavior can be tested cheaply, especially shared state helpers or components with existing test coverage. Verification before merge must include the repository’s WWW gate where available and at minimum:

- WWW unit/component tests relevant to changed files
- TypeScript typecheck
- production build
- lint/format checks if part of the repository gate

Manually inspect source-level responsive constraints for small mobile, tablet, desktop, and large desktop breakpoints. Do not claim live production is fixed unless deployment is separately verified.

## Merge Strategy

Work on `feat/www-interaction-responsive-system`, keep changes scoped to WWW and its directly shared primitives, open one PR, wait for required checks, and merge only when the branch is green and no newer conflicting `main` change needs reconciliation.
