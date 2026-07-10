# Deployment Architecture

Status: repo audit 2026-07-11.

## Compose Services Observed

`docker compose --env-file .env.development config --services` returns:

- `community_db`, `identity_db`, `marketplace_db`
- `rabbitmq`, `redis_cache`, `meilisearch`
- `identity_service`, `community_service`, `marketplace_service`, `chat_service`
- `scylla_db`, `scylla_keyspace_setup`
- `ollama`
- `www`, `usaha`, `cms`, `crm`
- `minio`, `mailhog`, `pgadmin`, `db_ui`, `caddy`

## Local Startup

Primary command:

```powershell
.\up-super-fast.ps1
```

Observed AI-related options/behavior:

- Default script parameters include `llama3.2:3b` business model and `moondream:latest` vision model.
- AI can add compose profile `ai`, set `USE_OLLAMA=true`, and start `ollama`.
- Ollama is bound to `127.0.0.1:${OLLAMA_PORT:-11434}:11434`.
- Compose sets `OLLAMA_NUM_PARALLEL=1` and `OLLAMA_MAX_LOADED_MODELS=1` defaults to reduce local pressure.

## Runtime Notes

- `ai_service` is present in source but commented out in base compose sections inspected. Product AI routes in `www` use Ollama/internal/external providers.
- `www` mounts `.runtime`, `.runtime/ai-learning`, and `.runtime/personal-ai` in compose.
- Meilisearch is a first-class service for marketplace search.
- Chat depends on ScyllaDB setup completion.

## Security Rules

- Never expose Ollama to public internet.
- Keep provider/API secrets out of docs and logs.
- Avoid copying `.env.development` values; use variable names only.
