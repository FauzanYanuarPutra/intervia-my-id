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

for service in ("identity_db:", "marketplace_db:", "community_db:"):
    if service not in base_compose:
        errors.append(f"base compose lost owned database service: {service[:-1]}")

if "restart: unless-stopped" not in base_compose:
    errors.append("base compose must retain process restart policy")

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
    "identity_app",
    "marketplace_app",
    "community_app",
):
    if marker not in prometheus_config:
        errors.append(f"Prometheus config missing required job: {marker}")

for marker in ("LajukanProbeFailed", "LajukanPostgresDown", "LajukanRedisDown"):
    if marker not in alerts_config:
        errors.append(f"Prometheus alert rules missing: {marker}")

for marker in ("http_2xx", "tcp_connect"):
    if marker not in blackbox_config:
        errors.append(f"blackbox config missing module: {marker}")

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


for warning in warnings:
    print(f"WARNING: {warning}", file=sys.stderr)

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print("Reliability architecture contract OK")
