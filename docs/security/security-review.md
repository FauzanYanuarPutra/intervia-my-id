# Security Review

Status: initial repository security review 2026-07-11. No production scan or penetration test was performed.

## Summary

This review is based on static repository inspection. It does not print or copy secret values.

## Findings

| ID | Severity | Area | Finding | Evidence | Impact | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| SEC-001 | Critical | Secrets | Root env files contain many secret-like values and have been visible in local context. | Static count found `.env.development` with 31 sensitive-like lines and `.env.production` with 28. Values are intentionally not copied here. | Token/API key compromise if any real value was shared or committed. | Rotate exposed credentials, keep env files untracked, create sanitized `.env.example`, and avoid pasting env values into chats/docs. |
| SEC-002 | High | Upload/AI | `ai_service` verification upload path used `unwrap()` after a missing-file check. | `services/ai_service/src/main.rs` around multipart `ktp`/`selfie` handling. | Low-probability panic risk if future edit weakens guard; poor pattern for upload boundary. | Applied: replaced unwrap with pattern matching while preserving the same error JSON. |
| SEC-003 | High | Logging | OTP/email/reset and provider paths include console logging that may print sensitive context in non-dev environments. | `frontend/www/src/lib/email.ts`, WhatsApp/Fonnte helpers, auth/webhook routes. | PII/OTP/reset-link leakage in logs. | Gate dev-only logs by environment and mask PII. |
| SEC-004 | High | Authorization | Object-level authorization coverage was not verified for all BFF routes and marketplace/community/chat operations. | Large API surface in `frontend/www/src/app/api`, backend `/v1/*`. | Horizontal privilege escalation risk. | Add contract/security tests for ownership checks on content, chat rooms, transactions, wallet, support, CRM. |
| SEC-005 | Medium | Chat/Realtime | Chat block/report/rate-limit and socket lifecycle were not fully verified. | Chat docs/schema show rooms/messages/read state; deeper realtime checks pending. | Spam, unwanted contact, or unauthorized read risk if membership checks are incomplete. | Audit controllers/channels and add membership/rate-limit tests. |
| SEC-006 | Medium | Search/Index | Meilisearch sync privacy/visibility behavior not verified. | Meili configured; lifecycle not fully audited. | Private/deleted/stale listing exposure. | Document index schema and add tests for visibility/deletion. |
| SEC-007 | Medium | Media | Upload validation policy may vary by route. | Multiple upload routes for content/chat/forum/profile/super-app. | XSS, malware, oversized files, unsafe metadata. | Centralize upload validation rules and document per route. |

## Authentication Review Notes

Evidence exists for password, phone login, OTP, Google OAuth, JWT, refresh, session, lockout config, and profile verification. Missing follow-up: brute-force behavior, token revocation, cookie flags, redirect validation, and enumeration resistance should be tested route-by-route.

## Authorization Review Notes

Ownership and role checks need deeper endpoint-level audit for:

- content/listing edit/delete;
- wallet/transaction actions;
- chat room membership;
- support ticket access;
- CRM/CMS admin routes;
- community group permissions;
- reels update/delete.

## Input/Output Review Notes

Priority areas:

- file upload MIME/size/path handling;
- AI image route limits and provider timeout handling;
- webhook signature/verification handling;
- error responses that include provider/internal error details;
- public phone/WhatsApp display consent.

## Secret Handling Rule

If a secret is found, document only the file name and variable category. Do not print the value. Rotate outside this agent task unless explicitly authorized.
