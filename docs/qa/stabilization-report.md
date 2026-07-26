# Lajukan Stabilization QA Report

Date: 2026-07-11
Scope: regression smoke for recent product fixes around distance labels, search width, UMKM map discovery visibility, buyer/provider chips, CRM documentation, and passive CRM event safety.

## Summary

This pass focused on stabilizing existing flows, not adding major features.

Result:

- Distance labels now use real viewer/backend distance data and are hidden when no safe distance exists.
- UMKM distance labels below 1 km are formatted as meters, for example `320 m`.
- Search and core public routes were checked for horizontal overflow across mobile, tablet, and desktop viewports.
- `/id/umkm` map discovery controls were checked so search controls stay visible and clickable above the map layer.
- Buyer/provider chip colors were reviewed as a product decision area, but no further palette change was made in this QA pass.
- CRM work remains documentation/foundation level. No new CRM auto-lead behavior was enabled from passive search/click/map events.

## Environment

| Item | Value |
| --- | --- |
| Workspace | `D:\lajukan\intervia-my-id` |
| Frontend | `frontend/www` |
| Browser test | Playwright Chromium |
| Unit test | Vitest |
| Required viewport set | `360x800`, `390x844`, `768x1024`, `1024x768`, `1366x768`, `1440x900` |
| Backend mode | API responses mocked for route smoke unless noted |

## Code Changes From This QA Pass

| Area | Files | Reason |
| --- | --- | --- |
| Distance formatting | `src/lib/geo/distance.ts` | Shared formatter for null-safe meter/km labels |
| UMKM place presentation | `src/lib/super-app/umkm-place-ui.ts` | Avoids fake distance when viewer or listing coordinates are unavailable/invalid |
| Distance consumers | search, home recommendation, UMKM map preview, content detail | Reuse one formatter so labels stay consistent |
| Tests | `distance.test.ts`, `umkm-place-ui.test.ts`, `lajukan-stabilization.spec.ts` | Regression coverage for distance, route overflow, UMKM controls |

## Route Matrix

| Route | Viewport | Scenario | Result | Issue | Severity | Fix | Test |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/id/home` | all required | Render route and check document width | Passed | None in smoke | - | Existing UI retained | Playwright |
| `/id/explore?q=supplier%20kemasan` | all required | Render route and check document width | Passed | Previous risk: horizontal overflow | Medium | Explore results layout constrained earlier; regression test added | Playwright |
| `/id/umkm` | all required | Render route and check document width | Passed | Previous risk: controls hidden by map/immersive layer | High | Existing map layer fix retained; regression test added | Playwright |
| `/id/create` | all required | Render public route and check document width | Passed | Auth/publish not covered | Medium | Not changed | Playwright |
| `/id/community` | all required | Render route and check document width | Passed | Deep community-to-contact flow not covered | Medium | Not changed | Playwright |
| `/id/reels` | all required | Render route and check document width | Passed | Contact handoff not covered | Medium | Not changed | Playwright |
| `/id/login?next=%2Fid%2Fcontent%2Fe2e-kemasan-001` | all required | Render login return route and check document width | Passed | OAuth callback/open-redirect not fully tested | High | Not changed | Playwright |
| `/id/register` | all required | Render route and check document width | Passed | OTP/backend register not covered | Medium | Not changed | Playwright |
| `/id/support` | all required | Render route and check document width | Passed | Ticket submit not covered | Low | Not changed | Playwright |
| `/id/content/e2e-kemasan-001` | all required | Render detail route with fixture data and check document width | Passed | Real backend detail not covered | Medium | Not changed | Playwright |
| `/id/explore` | `390x844` | Fill search, press Enter, verify URL and width | Passed | Hidden desktop input was selected on first run | Low | Locator now targets visible search input | Playwright |
| `/id/umkm` | `390x844` | Click search/map control trial above map layer | Passed | None after current fixes | - | Regression test added | Playwright |
| `/id/umkm` | `390x844` | Verify `320 m` is hidden before viewer location exists | Passed | Previous risk: misleading hardcoded distance | High | Distance now hidden until viewer/backend distance exists | Playwright |

## Command Results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:unit -- src/lib/geo/distance.test.ts src/lib/super-app/umkm-place-ui.test.ts` | Passed | 2 files, 7 tests |
| `npx playwright test tests/e2e/lajukan-stabilization.spec.ts --project=chromium` | Passed | 9 tests on Chromium, latest run 44.4s |
| `cargo check --manifest-path services\marketplace_service\Cargo.toml` | Passed | Marketplace service compile check |
| `npx eslint ...touched files...` | Passed with warnings | 0 errors. Existing unused/img warnings remain in large home/detail files |
| `npm run lint` | Failed | Repo-wide lint still has 96 errors and 233 warnings outside this stabilization patch |

## Findings

| Finding | Severity | Status | Notes |
| --- | --- | --- | --- |
| UMKM distance could show misleading nearby labels when viewer location was unavailable | High | Fixed | Labels now require safe distance data |
| Distance under 1 km was less human-friendly as `0.3 km` | Medium | Fixed | Shared formatter displays `320 m` |
| Search page horizontal overflow risk | High | Covered | Smoke covers six viewport sizes |
| UMKM discovery controls could be visually present but blocked by map layers | High | Covered | Trial click confirms controls are targetable |
| Repo-wide lint failure | Medium | Open | Pre-existing/codebase-wide debt; not fixed in stabilization pass |
| Authenticated publish/chat/payment flows not fully validated | High | Open | Need seeded auth and backend integration environment |

## Security And Privacy Notes

- No secrets were added or printed into docs.
- Distance display avoids showing implied proximity unless location data is available and coordinates are valid.
- CRM passive lead creation remains guarded by configuration and should stay disabled by default until consent and abuse controls are fully tested.
- Login `next` rendering was smoke-tested, but open redirect and OAuth callback flows need a dedicated security test.
- Object-level authorization remains a known risk area from earlier security docs and was not exhaustively verified in this smoke pass.

## Performance Notes

- This QA pass did not run Lighthouse or browser performance tracing.
- Route smoke verified render stability and absence of document overflow only.
- Existing staged assets include large media files. Before production release, image sizing and `next/image` usage should be reviewed for LCP and bandwidth impact.
- Repo-wide lint still reports `no-img-element` warnings in shared UI/home components.

## Release Readiness

| Area | Readiness | Reason |
| --- | --- | --- |
| Distance label fix | Ready for review | Unit and route smoke passed |
| Search width stability | Ready for review | Multi-viewport smoke passed |
| UMKM discovery visibility | Ready for review | Controls visible/clickable in smoke |
| CRM docs/foundation | Needs product review | Docs/foundation only; do not enable passive leads by default |
| Full public release | Not ready from this QA alone | Auth, real backend, chat, create publish, and production data paths need deeper testing |

## Next QA Steps

1. Add an authenticated test user fixture for create-to-publish, chat-to-seller, save, report, and profile flows.
2. Run integration smoke against real local services after migrations are applied.
3. Add security tests for `next` redirect validation and object-level access on listing/contact/chat APIs.
4. Add a small performance budget check for home, search, and `/id/umkm`.
5. Clean repo-wide lint debt or split CI into "changed files must be clean" plus "legacy debt report".
