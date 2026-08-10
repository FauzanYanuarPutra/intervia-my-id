# Lessons Learned

Status: repo audit 2026-07-11.

## Repository Lessons

- The product is already broader than a simple marketplace; search, UMKM maps, community, reels, chat, CRM/CMS, wallet, and AI surfaces exist.
- Existing implementation should be extended carefully instead of rebuilding duplicate flows.
- Local AI through Docker/Ollama is useful for cost control but must be conservative, optional, and resource-aware.
- `up-super-fast.ps1` is the primary local orchestration surface and already contains AI profile/model logic.
- Documentation can lag behind runtime. Treat migrations, routes, and compose as stronger evidence than older docs.

## Product Lessons

- Users should not be forced into one communication mode. Chat and WhatsApp solve different jobs.
- AI should reduce form friction and explain choices, not become the authority for seller facts.
- Transaction primitives exist, but product copy must follow verified operational readiness.
- Location is valuable only when data quality is clear.

## Engineering Lessons

- Avoid changing code while doing product architecture audit.
- Search with `rg` first; route/migration scans reveal product reality quickly.
- Dirty worktrees are expected; do not revert unrelated user changes.
- Use docs to record uncertainty instead of hiding it in assumptions.
- Remove panic-prone patterns at request/upload boundaries with small behavior-preserving slices before attempting large refactors.
- A healthy MinIO container proves that the service is reachable, not that an application bucket exists. Local startup must create or verify every required bucket idempotently before media-dependent services are treated as ready.
- A successful `docker compose up` does not prove the requested stack is usable. The local launcher must distinguish healthy long-running services from successful one-shot setup containers and fail on terminal exits or restart loops.
- A running `cloudflared` process is not yet a working tunnel. Startup readiness must also observe at least one registered edge connection before reporting the local stack ready.
- Treat Compose configuration and image build inputs separately. A port, profile, healthcheck, or environment change needs container reconciliation, while rebuilding every application image for that edit makes the fast launcher both slow and misleading.
- Local reverse-proxy host labels must be unambiguous, and pgAdmin development accounts using a reserved local suffix require its documented special-domain allowlist; otherwise both containers can appear created while never becoming usable.
