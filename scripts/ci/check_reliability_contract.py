from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[2]
errors: list[str] = []
warnings: list[str] = []


def read(path: str) -> str:
    target = ROOT / path
    if not target.is_file():
        errors.append(f"missing required reliability file: {path}")
        return ""
    return target.read_text(encoding="utf-8")


base_compose = read("docker-compose.yml")
prod_compose = read("docker-compose.prod.yml")
deploy = read(".github/workflows/deploy.yml")
caddy = read("infrastructure/caddy/Caddyfile.prod")
scale_doc = read("docs/architecture/scale-reliability-v1.md")
slo_doc = read("docs/operations/slo-capacity-overload.md")
incident_doc = read("docs/operations/incident-response.md")
load_script = read("scripts/load/k6-read-paths.js")
read("docs/operations/backup-and-disaster-recovery.md")
observability_compose = read("docker-compose.observability.yml")
prometheus_config = read("infrastructure/observability/prometheus.yml")
alerts_config = read("infrastructure/observability/alerts.yml")
blackbox_config = read("infrastructure/observability/blackbox.yml")
postgres_backup_script = read("scripts/ops/postgres_logical_backup.sh")
backup_verify_script = read("scripts/ops/verify_backup_set.sh")

for service in ("identity_db:", "marketplace_db:", "community_db:"):
    if service not in base_compose:
        errors.append(f"base compose lost owned database service: {service[:-1]}")

if "restart: unless-stopped" not in base_compose:
    errors.append("base compose must retain process restart policy")

for marker in (
    "./infrastructure/rabbitmq/enabled_plugins:/etc/rabbitmq/enabled_plugins:ro",
    'expose: ["15692"]',
):
    if marker not in base_compose:
        errors.append(f"RabbitMQ observability contract missing: {marker}")

rabbitmq_plugins = read("infrastructure/rabbitmq/enabled_plugins")
for marker in ("rabbitmq_management", "rabbitmq_prometheus"):
    if marker not in rabbitmq_plugins:
        errors.append(f"RabbitMQ enabled_plugins missing: {marker}")

for marker in ("stop_grace_period: 30s", "stop_grace_period: 60s"):
    if marker not in base_compose:
        errors.append(f"base compose missing graceful shutdown budget: {marker}")

for marker in (
    "profiles: [observability]",
    "prom/prometheus:v3.14.0",
    "prom/node-exporter:v1.12.1",
    "gcr.io/cadvisor/cadvisor:v0.60.5",
    "prom/blackbox-exporter:v0.28.0",
    "quay.io/prometheuscommunity/postgres-exporter:v0.20.1",
    "oliver006/redis_exporter:v1.91.1",
):
    if marker not in observability_compose:
        errors.append(f"observability overlay missing pinned component/profile: {marker}")

for marker in (
    "blackbox_http",
    "blackbox_tcp",
    "postgres_identity",
    "redis",
    "rabbitmq",
    "identity_app",
    "marketplace_app",
    "community_app",
):
    if marker not in prometheus_config:
        errors.append(f"Prometheus config missing required job: {marker}")

for marker in ("LajukanProbeFailed", "LajukanPostgresDown", "LajukanRedisDown", "LajukanHttp5xxRateHigh", "LajukanHttpP95LatencyHigh", "LajukanRabbitMqBacklogHigh", "LajukanRabbitMqNoConsumers"):
    if marker not in alerts_config:
        errors.append(f"Prometheus alert rules missing: {marker}")

for marker in ("http_2xx", "tcp_connect"):
    if marker not in blackbox_config:
        errors.append(f"blackbox config missing module: {marker}")

for marker in (
    "IDENTITY_DB_MAX_CONNECTIONS",
    "IDENTITY_DB_MIN_CONNECTIONS",
    "IDENTITY_DB_ACQUIRE_TIMEOUT_SECONDS",
    "MARKETPLACE_DB_MAX_CONNECTIONS",
    "MARKETPLACE_DB_MIN_CONNECTIONS",
    "MARKETPLACE_DB_ACQUIRE_TIMEOUT_SECONDS",
    "COMMUNITY_DB_MAX_CONNECTIONS",
    "COMMUNITY_DB_MIN_CONNECTIONS",
    "COMMUNITY_DB_ACQUIRE_TIMEOUT_SECONDS",
):
    if marker not in base_compose:
        errors.append(f"base compose missing DB pool budget variable: {marker}")

for path, markers in {
    "services/identity_service/src/db/postgres.rs": (
        "cfg.db_max_connections",
        "cfg.db_min_connections",
        "cfg.db_acquire_timeout_seconds",
    ),
    "services/marketplace_service/src/main.rs": (
        "MARKETPLACE_DB_MAX_CONNECTIONS",
        "MARKETPLACE_DB_MIN_CONNECTIONS",
        "MARKETPLACE_DB_ACQUIRE_TIMEOUT_SECONDS",
    ),
    "services/community_service/src/main.rs": (
        "COMMUNITY_DB_MAX_CONNECTIONS",
        "COMMUNITY_DB_MIN_CONNECTIONS",
        "COMMUNITY_DB_ACQUIRE_TIMEOUT_SECONDS",
        "DatabasePoolPurpose::Migration",
    ),
}.items():
    source = read(path)
    for marker in markers:
        if marker not in source:
            errors.append(f"{path} missing DB pool budget marker: {marker}")


if "SCYLLA_NODES: ${SCYLLA_NODES:?" not in prod_compose:
    errors.append("production chat must fail closed when SCYLLA_NODES is absent")

if "MINIO_DATA_VOLUME:?" not in prod_compose:
    errors.append("production object storage must require an explicitly resolved existing volume")

if "development-database" not in prod_compose:
    errors.append("production compose must keep single-node Scylla out of the normal production profile")

for marker in (
    "sha-[0-9a-f]{40}",
    ".last-successful-",
    "rollback_on_error",
    "--wait --wait-timeout",
    "docker-compose.observability.yml",
    "infrastructure/observability",
    "https://www.",
    "https://api.",
    "https://chat.",
):
    if marker not in deploy:
        errors.append(f"deploy workflow missing reliability marker: {marker}")

if "reverse_proxy" not in caddy:
    errors.append("production Caddy config has no reverse proxy")
if "@internal_metrics path /metrics" not in caddy:
    errors.append("production edge must block private /metrics endpoints")
if "127.0.0.1" in caddy or "localhost:" in caddy:
    errors.append("production Caddy upstreams must use internal service discovery, not localhost")

for upstream in (
    "identity_service:8080",
    "marketplace_service:8081",
    "community_service:8082",
    "chat_service:4000",
):
    if upstream not in caddy:
        errors.append(f"production edge lost upstream route: {upstream}")

for marker in (
    "one operational failure domain",
    "PostgreSQL remains the transactional source of truth",
    "Redis, RabbitMQ and Meilisearch must not become the only durable copy",
    "Phase 2 — remove the single-host failure domain",
    "cells",
):
    if marker not in scale_doc:
        errors.append(f"scale architecture missing required principle: {marker}")

for marker in ("Error budget", "Retry budget", "Overload behavior", "Capacity review"):
    if marker not in slo_doc:
        errors.append(f"SLO policy missing section: {marker}")

for marker in ("SEV-1", "rollback", "PostgreSQL", "Payment provider", "Recovery validation"):
    if marker not in incident_doc:
        errors.append(f"incident runbook missing recovery concept: {marker}")

if "127.0.0.1" not in load_script:
    errors.append("load-test harness must default to loopback")
for destructive in ("http.post(", "http.put(", "http.patch(", "http.del(", "http.delete("):
    if destructive in load_script:
        errors.append(f"default load-test harness must stay read-only: found {destructive}")

for path, threshold in (
    ("services/marketplace_service/src/main.rs", 250_000),
    ("services/community_service/src/main.rs", 200_000),
):
    target = ROOT / path
    if target.is_file() and target.stat().st_size > threshold:
        warnings.append(
            f"{path} is {target.stat().st_size:,} bytes; continue responsibility-based extraction before scale-driven service splits"
        )

if not re.search(r"image:\s+\$\{DOCKERHUB_NAMESPACE", prod_compose):
    errors.append("production services must continue using registry image references")

for path in (
    "services/identity_service/src/runtime_metrics.rs",
    "services/marketplace_service/src/runtime_metrics.rs",
    "services/community_service/src/runtime_metrics.rs",
):
    source = read(path)
    for marker in (
        "lajukan_http_requests_total",
        "lajukan_http_responses_total",
        "lajukan_http_in_flight_requests",
        "lajukan_http_request_duration_seconds_bucket",
        'request.uri().path() == "/metrics"',
    ):
        if marker not in source:
            errors.append(f"{path} missing RED metrics marker: {marker}")


for path in (
    "services/identity_service/src/main.rs",
    "services/marketplace_service/src/main.rs",
    "services/community_service/src/main.rs",
):
    source = read(path)
    for marker in ('route("/ready"', 'route("/metrics"', "with_graceful_shutdown"):
        if marker not in source:
            errors.append(f"{path} missing runtime reliability marker: {marker}")


for path, markers in {
    "services/identity_service/src/main.rs": (
        "FOR UPDATE SKIP LOCKED",
        "status IN ('pending', 'failed', 'publishing')",
        "available_at = NOW() + INTERVAL '2 minutes'",
    ),
    "services/marketplace_service/src/main.rs": (
        "FOR UPDATE SKIP LOCKED",
        "status IN ('pending', 'processing')",
        "available_at = NOW() + INTERVAL '2 minutes'",
    ),
    "services/community_service/src/main.rs": (
        "status = 'processing' AND available_at <= now()",
        "available_at = now() + INTERVAL '2 minutes'",
    ),
}.items():
    source = read(path)
    for marker in markers:
        if marker not in source:
            errors.append(f"{path} outbox worker missing crash-recovery lease marker: {marker}")


for marker in (
    "pg_dump",
    "pg_restore --list",
    "sha256sum",
    "Refusing to place backups inside the Git repository",
):
    if marker not in postgres_backup_script:
        errors.append(f"PostgreSQL backup script missing safety/verification marker: {marker}")

for marker in ("sha256sum -c", "pg_restore --list", "This does not replace an isolated restore drill"):
    if marker not in backup_verify_script:
        errors.append(f"backup verification script missing marker: {marker}")

community_source = read("services/community_service/src/main.rs")
community_rate_limit_migration = read(
    "services/community_service/migrations/20260918010000_shared_rate_limit_counters.up.sql"
)
for marker in (
    "community_rate_limit_counters",
    "ON CONFLICT (rate_key, window_bucket)",
    "run_rate_limit_cleanup",
):
    if marker not in community_source:
        errors.append(f"Community shared rate limiter missing runtime marker: {marker}")
for marker in ("PRIMARY KEY (rate_key, window_bucket)", "expires_at"):
    if marker not in community_rate_limit_migration:
        errors.append(f"Community shared rate limiter migration missing marker: {marker}")
if "Mutex<RateLimitStore>" in community_source:
    errors.append("Community rate limiting must not regress to per-replica in-memory state")

for warning in warnings:
    print(f"WARNING: {warning}", file=sys.stderr)

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print("Reliability architecture contract OK")
