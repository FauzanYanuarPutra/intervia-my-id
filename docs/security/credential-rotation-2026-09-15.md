# Credential Rotation Checklist — 2026-09-15

This checklist tracks credential families detected in historical repository scans. It intentionally contains **no credential values**.

## Why this exists

A credential removed from the current tree can still exist in public Git history, forks, caches, CI logs, screenshots, or local clones. Git cleanup is not a substitute for rotation or revocation.

## Required remediation

- [ ] **GROQ API credential** — revoke the historical credential in the provider console, create a replacement only if still needed, store the replacement in the deployment secret store, and verify no application config falls back to a committed value.
- [ ] **Google OAuth client secret** — rotate the affected OAuth client secret, update deployment secrets, verify redirect/callback flows, and revoke the prior secret.
- [ ] **Cloudflare tunnel credential** — rotate/recreate the affected tunnel token or credential, update the deployment secret store, and invalidate the historical value.
- [ ] **WhatsApp Meta webhook verification token** — generate a new random token, set `WHATSAPP_META_WEBHOOK_VERIFY_TOKEN` in the deployment secret store, configure the same new value in Meta, and verify the callback handshake. The application no longer contains a committed production fallback.
- [ ] **WhatsApp Meta app/access credentials, if ever shared outside the secret store** — rotate/revoke them in Meta and update deployment secrets.
- [ ] **Browser-profile/session material from historical `.codex-chrome-home-scroll*` directories** — treat reusable session/token material as compromised; sign out/revoke affected sessions where applicable. The directories are now ignored so they cannot be committed again.

## Verification after rotation

- [ ] Production and staging deployments read credentials only from their secret stores/environment configuration.
- [ ] Authentication, OAuth, tunnel, webhook verification, and WhatsApp delivery flows still work with the replacements.
- [ ] The old credentials are rejected by their providers.
- [ ] Run the scheduled full-history Security workflow again and review every remaining Gitleaks finding.
- [ ] Only after provider-side revocation is verified, add exact Gitleaks fingerprints for the remediated historical findings if keeping the old Git history is intentional.

## Git history decision

Rewriting public history is optional after rotation and has operational costs: all branch SHAs change, collaborators must re-clone/rebase, open branches may diverge, and copies/forks outside this repository remain unaffected. If a history rewrite is chosen, coordinate it as a separate maintenance operation after all affected credentials have been revoked.

## Done criteria

This incident is considered closed only when provider-side revocation/rotation is verified, replacement integrations pass functional checks, and the full-history security scan has no unexplained credential findings.
