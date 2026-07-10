# Lajukan

Lajukan is a compact marketplace and super-app for jobs, services, property, rentals (pinjam/meminjamkan), and UMKM. The UI is optimized for ultra-compact density and fast scanning, with Trust Center pages for policy and safety.

## Repo layout
- `frontend/www`: main web app
- `frontend/cms`, `frontend/crm`: internal panels
- `backend`: services and APIs
- `docker-compose.yml`: local stack

## Quick start (local)
1. Copy env: duplicate `.env.example` to `.env` or `.env.development`.
2. Docker on WSL/Linux: `bash ./up-super-fast.sh`
3. Docker on Windows PowerShell: `.\up-super-fast.ps1`
   Local AI/Ollama is included by default in dev mode.
   Without local AI: `.\up-super-fast.ps1 -NoAi`
   Lightweight text-only AI: `.\up-super-fast.ps1 -AiTextOnly`
   Skip AI model check/download: `.\up-super-fast.ps1 -SkipAiModels`
4. Untuk workflow dev yang lebih hemat storage di Windows:
   `.\dev-stack.ps1 up` untuk jalan biasa,
   `.\dev-stack.ps1 fresh` untuk hapus container project + build cache tak terpakai lalu jalan lagi,
   `.\dev-stack.ps1 nuke` untuk full reset volume/data local lalu jalan lagi.
5. One-command live frontend dev:
   PowerShell: `.\dev-live.ps1`
   WSL/Linux: `bash ./dev-live.sh`
   Ini akan menyalakan container core yang dibutuhkan lalu menjalankan Next dev server lokal dengan auto-reload.
   App lain:
   PowerShell: `.\dev-live.ps1 -App usaha`
   PowerShell: `.\dev-live.ps1 -App cms`
   PowerShell: `.\dev-live.ps1 -App crm`
   Bash: `bash ./dev-live.sh usaha`
   Bash: `bash ./dev-live.sh cms`
   Bash: `bash ./dev-live.sh crm`
   Kalau butuh chat/scylla juga:
   PowerShell: `.\dev-live.ps1 -FullStack`
   Bash: `FULL_STACK=1 bash ./dev-live.sh`
6. Direct compose fallback, only if Docker Compose v2 (`docker compose`) is available:
   `docker compose --env-file .env.development build identity_service marketplace_service www usaha cms crm && docker compose --env-file .env.development up -d postgres_db redis_cache rabbitmq meilisearch identity_service marketplace_service www usaha cms crm mailhog`
7. Open the web app based on the ports in `docker-compose.yml`.

The `up-super-fast` scripts are the preferred local entrypoint because they serialize builds and warm missing base images first. That avoids common WSL/Docker Hub DNS timeouts during multi-service `docker compose build`.
Untuk development di Windows, `dev-stack.ps1` adalah wrapper yang lebih aman dipakai dibanding `docker compose up -d --build` langsung karena build hanya dilakukan saat perlu dan ada mode cleanup yang eksplisit.

Important for WSL/Linux:
- Do not use legacy `docker-compose` v1 directly for this repo if you can avoid it. It can fail during recreate with `KeyError: 'ContainerConfig'`, especially on `www`, `usaha`, `cms`, and `crm`.
- Prefer `bash ./up-super-fast.sh` or `docker compose ...`.
- If you are stuck on `docker-compose` v1 and hit that error, remove the stale service containers first, then start again:
  `bash ./legacy-compose-cleanup.sh www usaha cms crm`
  `docker-compose up -d www usaha cms crm`
- To clear every stale container in the project before retrying:
  `bash ./legacy-compose-cleanup.sh --all`
  `bash ./up-super-fast.sh`

Important for Windows PowerShell:
- Prefer `.\up-super-fast.ps1` or `.\dev-stack.ps1 up`.
- If legacy `docker-compose` recreate gets stuck, remove the stale containers first:
  `.\legacy-compose-cleanup.ps1 -Services cms,crm`
  `docker-compose up -d cms crm`

Default local startup sekarang memakai stack inti yang lebih ringan:
`postgres_db`, `redis_cache`, `rabbitmq`, `meilisearch`, `identity_service`, `marketplace_service`, `www`, `cms`, `crm`, `mailhog`.

Service berat dinyalakan manual hanya saat perlu, misalnya:
- Bash: `bash ./up-super-fast.sh scylla_db scylla_keyspace_setup chat_service ai_service ocr_service liveness_service minio qdrant`
- PowerShell: `.\up-super-fast.ps1 -Services scylla_db,scylla_keyspace_setup,chat_service,ai_service,ocr_service,liveness_service,minio,qdrant`

## Frontend (manual)
- `cd frontend/www`
- `npm install`
- `npm run dev`
- `npm run lint`

## CRM role
- `frontend/crm` is the operational command center, not just a sales list.
- Use CRM to handle 4 lanes from `frontend/www`: lead intake from listings/chat/orders, support and dispute handling, trust policy approvals, and fraud/risk review.
- Sensitive CRM actions should require 2-step verification, especially trust profile changes, manual holds, and risky order status updates.
- CRM decisions should always read WWW identity signals such as KTP OCR, liveness, transaction eligibility, trust profile, chat context, and ticket history.

## Core flows
- **Search**: grouped filters (jobs, freelancer, products/services, property, rentals, UMKM).
- **Create**: compact form with optional fields in accordions.
- **Trust**: `/[locale]/trust` and topic pages for policies and safety.

## UMKM commerce
- UMKM storefront supports online + offline orders.
- Products can be configured as physical or digital.
- Online checkout now supports fulfillment modes: courier/expedition, pickup, and digital delivery.
- Shipping fee estimation is configurable with `UMKM_SHIPPING_*` environment variables.

## UX rules
- 1 title + 1 short paragraph + max 3 CTAs in hero.
- Use global CSS tokens (`--app-*`, `ui-*` utilities) for colors.
- Long details go behind expanders or subpages.

## Performance and security notes
- Prefer debounced search and compact payloads.
- Use server endpoints for sensitive actions (export data, delete account).
- Keep color themes centralized via CSS variables.
