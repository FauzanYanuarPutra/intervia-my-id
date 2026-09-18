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
caddy_local = read("infrastructure/caddy/Caddyfile")
scale_doc = read("docs/architecture/scale-reliability-v1.md")
slo_doc = read("docs/operations/slo-capacity-overload.md")
incident_doc = read("docs/operations/incident-response.md")
load_script = read("scripts/load/k6-read-paths.js")
read("docs/operations/backup-and-disaster-recovery.md")
observability_compose = read("docker-compose.observability.yml")
prometheus_config = read("infrastructure/observability/prometheus.yml")
alerts_config = read("infrastructure/observability/alerts.yml")
slo_rules_config = read("infrastructure/observability/slo-rules.yml")
grafana_datasource = read("infrastructure/observability/grafana/provisioning/datasources/prometheus.yml")
grafana_dashboard_provider = read("infrastructure/observability/grafana/provisioning/dashboards/default.yml")
grafana_dashboard = read("infrastructure/observability/grafana/dashboards/lajukan-overview.json")
blackbox_config = read("infrastructure/observability/blackbox.yml")
postgres_backup_script = read("scripts/ops/postgres_logical_backup.sh")
backup_verify_script = read("scripts/ops/verify_backup_set.sh")
scale_rehearsal_script = read("scripts/ops/staging_scale_rehearsal.sh")
identity_runtime_metrics = read("services/identity_service/src/runtime_metrics.rs")
marketplace_runtime_metrics = read("services/marketplace_service/src/runtime_metrics.rs")
community_runtime_metrics = read("services/community_service/src/runtime_metrics.rs")
community_main_source = read("services/community_service/src/main.rs")
marketplace_identity_client = read("services/marketplace_service/src/businesses/identity_client.rs")

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
    "IDENTITY_HTTP_MAX_IN_FLIGHT",
    "MARKETPLACE_HTTP_MAX_IN_FLIGHT",
    "COMMUNITY_HTTP_MAX_IN_FLIGHT",
):
    if marker not in base_compose:
        errors.append(f"base compose missing overload budget: {marker}")

for prefix in ("IDENTITY", "MARKETPLACE", "COMMUNITY"):
    for suffix in ("DB_IDLE_TIMEOUT_SECONDS", "DB_MAX_LIFETIME_SECONDS"):
        marker = f"{prefix}_{suffix}"
        if marker not in base_compose:
            errors.append(f"base compose missing database lifecycle budget: {marker}")

for marker in (
    "MARKETPLACE_IDENTITY_TIMEOUT_MS",
    "COMMUNITY_IDENTITY_PREFETCH",
):
    if marker not in base_compose:
        errors.append(f"base compose does not pass reliability tuning into its service container: {marker}")

for path in (
    "services/identity_service/src/db/postgres.rs",
    "services/marketplace_service/src/main.rs",
    "services/community_service/src/main.rs",
):
    source = read(path)
    for marker in (".idle_timeout(", ".max_lifetime("):
        if marker not in source:
            errors.append(f"{path} missing database connection lifecycle marker: {marker}")

if not (
    identity_runtime_metrics
    == marketplace_runtime_metrics
    == community_runtime_metrics
):
    errors.append("core Rust runtime_metrics implementations drifted; keep request-id, RED metrics and overload shedding semantics identical")

for marker in (
    'env::var("HTTP_MAX_IN_FLIGHT")',
    "Semaphore",
    "try_acquire_request_permit",
    "StatusCode::SERVICE_UNAVAILABLE",
    "header::RETRY_AFTER",
    "lajukan_http_concurrency_limit",
    "lajukan_http_overload_rejections_total",
):
    if marker not in identity_runtime_metrics:
        errors.append(f"core Rust overload protection missing runtime marker: {marker}")

for marker in (
    "FOR UPDATE SKIP LOCKED",
    "RETURNING inbox.id, inbox.payload, inbox.available_at AS lease_until",
    "AND available_at = $2",
):
    if marker not in community_main_source:
        errors.append(f"Community multi-replica inbox claim contract missing: {marker}")

for marker in (
    "COMMUNITY_IDENTITY_PREFETCH",
    "BasicQosOptions",
    ".basic_qos(prefetch",
):
    if marker not in community_main_source:
        errors.append(f"Community RabbitMQ backpressure contract missing: {marker}")

for marker in (
    "community_rate_limit_counters",
    "FOR UPDATE SKIP LOCKED",
):
    if marker not in community_main_source:
        errors.append(f"Community multi-replica cleanup contract missing: {marker}")

for marker in (
    "MARKETPLACE_IDENTITY_TIMEOUT_MS",
    ".clamp(250, 10_000)",
    ".timeout(self.request_timeout)",
):
    if marker not in marketplace_identity_client:
        errors.append(f"Marketplace Identity dependency deadline missing: {marker}")

for marker in (
    'promtool", "query", "instant", "http://localhost:9090", "up"',
    'amtool", "--alertmanager.url=http://localhost:9093", "config", "show"',
):
    if marker not in observability_compose:
        errors.append(f"runtime observability health gate missing: {marker}")

for marker in (
    "profiles: [observability]",
    "ALERTMANAGER_CONFIG_PATH",
    "prom/prometheus:v3.14.0",
    "prom/node-exporter:v1.12.1",
    "gcr.io/cadvisor/cadvisor:v0.60.5",
    "prom/blackbox-exporter:v0.28.0",
    "quay.io/prometheuscommunity/postgres-exporter:v0.20.1",
    "oliver006/redis_exporter:v1.91.1",
    "grafana/grafana:13.2.1",
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

for marker in ("LajukanProbeFailed", "LajukanPostgresDown", "LajukanRedisDown", "LajukanHttp5xxRateHigh", "LajukanHttpP95LatencyHigh", "LajukanRabbitMqBacklogHigh", "LajukanRabbitMqNoConsumers", "LajukanRabbitMqMetricsDown", "LajukanOutboxBacklogHigh", "LajukanOutboxBacklogCritical", "LajukanOutboxOldestEventStale", "LajukanOutboxOldestEventCritical", "LajukanMetricsDbQueryFailed", "LajukanDbPoolSaturated", "LajukanHttpOverloadShedding"):
    if marker not in alerts_config:
        errors.append(f"Prometheus alert rules missing: {marker}")

for marker in ("http_2xx", "tcp_connect"):
    if marker not in blackbox_config:
        errors.append(f"blackbox config missing module: {marker}")

frontend_service_order = ("www", "cms", "crm", "usaha", "caddy")
for index, frontend_name in enumerate(frontend_service_order[:-1]):
    start = base_compose.find(f"\n  {frontend_name}:")
    end = base_compose.find(f"\n  {frontend_service_order[index + 1]}:", start)
    if start < 0 or end < 0:
        errors.append(f"unable to locate frontend Compose block: {frontend_name}")
        continue
    frontend_block = base_compose[start:end]
    if "depends_on:" in frontend_block:
        errors.append(
            f"Frontend process startup must remain independent from backend health: {frontend_name}"
        )


identity_compose_start = base_compose.find("\n  identity_service:")
identity_compose_end = base_compose.find("\n  marketplace_service:", identity_compose_start)
if identity_compose_start < 0 or identity_compose_end < 0:
    errors.append("unable to locate Identity Compose service block")
else:
    identity_compose = base_compose[identity_compose_start:identity_compose_end]
    for required_dependency in (
        "identity_db: { condition: service_healthy }",
        "redis_cache: { condition: service_healthy }",
    ):
        if required_dependency not in identity_compose:
            errors.append(f"Identity startup missing required dependency: {required_dependency}")
    if "rabbitmq: { condition: service_healthy }" in identity_compose:
        errors.append("Identity startup must remain isolated from RabbitMQ availability")

identity_state_source = read("services/identity_service/src/config/state.rs")
if "rabbitmq" in identity_state_source.lower():
    errors.append("Identity request state must not hold a RabbitMQ connection")

identity_main_source = read("services/identity_service/src/main.rs")
for marker in (
    "RabbitMQ is intentionally not part of request-serving readiness.",
    "run_identity_outbox_publisher",
):
    if marker not in identity_main_source:
        errors.append(f"Identity broker-degradation contract missing marker: {marker}")


marketplace_compose_start = base_compose.find("\n  marketplace_service:")
marketplace_compose_end = base_compose.find("\n  community_service:", marketplace_compose_start)
if marketplace_compose_start < 0 or marketplace_compose_end < 0:
    errors.append("unable to locate Marketplace Compose service block")
else:
    marketplace_compose = base_compose[marketplace_compose_start:marketplace_compose_end]
    if "marketplace_db: { condition: service_healthy }" not in marketplace_compose:
        errors.append("Marketplace startup must remain gated on its owned database")
    for forbidden_dependency in (
        "redis_cache: { condition: service_healthy }",
        "rabbitmq: { condition: service_healthy }",
        "meilisearch: { condition: service_healthy }",
        "identity_service: { condition: service_healthy }",
    ):
        if forbidden_dependency in marketplace_compose:
            errors.append(
                f"Marketplace startup must remain isolated from degradable dependency: {forbidden_dependency}"
            )

marketplace_source = read("services/marketplace_service/src/main.rs")
for marker in (
    "tokio::spawn(async move",
    "run_outbox_publisher",
    "run_identity_event_consumer",
):
    if marker not in marketplace_source:
        errors.append(f"Marketplace degraded-startup contract missing marker: {marker}")


community_compose_start = base_compose.find("\n  community_service:")
community_compose_end = base_compose.find("\n  chat_service:", community_compose_start)
if community_compose_start < 0 or community_compose_end < 0:
    errors.append("unable to locate Community Compose service block")
else:
    community_compose = base_compose[community_compose_start:community_compose_end]
    if "community_db: { condition: service_healthy }" not in community_compose:
        errors.append("Community startup must remain gated on its owned database")
    for forbidden_dependency in (
        "redis_cache: { condition: service_healthy }",
        "rabbitmq: { condition: service_healthy }",
        "identity_service: { condition: service_healthy }",
    ):
        if forbidden_dependency in community_compose:
            errors.append(
                f"Community startup must remain isolated from degradable dependency: {forbidden_dependency}"
            )

community_source = read("services/community_service/src/main.rs")
for marker in (
    "Identity enrichment is best-effort and must not delay Community readiness.",
    "COMMUNITY_STARTUP_IDENTITY_RECONCILE_ENABLED",
    "tokio::spawn(async move",
    "run_identity_profile_consumer",
):
    if marker not in community_source:
        errors.append(f"Community degraded-startup contract missing marker: {marker}")


if "COMMUNITY_STARTUP_IDENTITY_RECONCILE_ENABLED" not in base_compose:
    errors.append("base compose missing explicit Community identity reconciliation repair flag")


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

if "COMMUNITY_UPLOADS_VOLUME:?" not in prod_compose:
    errors.append("production community media must require an explicitly resolved existing volume")

for marker in (
    'configured_community_volume',
    'active_community_volumes',
    'COMMUNITY_UPLOADS_VOLUME',
    '/app/uploads/forum',
    'Refusing storage switch',
):
    if marker not in deploy:
        errors.append(f"deploy workflow missing Community media storage guard: {marker}")

if "development-database" not in prod_compose:
    errors.append("production compose must keep single-node Scylla out of the normal production profile")

for marker in (
    "sha-[0-9a-f]{40}",
    ".last-successful-",
    "rollback_on_error",
    "--wait --wait-timeout",
    "docker-compose.observability.yml",
    "infrastructure/observability",
    "ALERTMANAGER_CONFIG_PATH",
    "local-null Alertmanager config",
    "Refusing silent alert discard",
    "https://www.",
    "https://api.",
    "https://chat.",
):
    if marker not in deploy:
        errors.append(f"deploy workflow missing reliability marker: {marker}")

for marker in (
    "grace_period 30s",
    "(access_log)",
    "output stdout",
    "format filter",
    "replace access_token REDACTED",
    "replace code REDACTED",
    "wrap json",
):
    if marker not in caddy:
        errors.append(f"production edge missing structured access log/safety marker: {marker}")

if "reverse_proxy" not in caddy:
    errors.append("production Caddy config has no reverse proxy")
if "@internal_metrics path /metrics" not in caddy:
    errors.append("production edge must block private /metrics endpoints")
if caddy_local.count("@internal_metrics path /metrics") < 2:
    errors.append("local/tunnel edge must block private /metrics on API and auth hosts")
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

for path, warning_threshold, hard_ceiling in (
    ("services/marketplace_service/src/main.rs", 250_000, 850_000),
    ("services/community_service/src/main.rs", 200_000, 325_000),
):
    target = ROOT / path
    if not target.is_file():
        continue
    size = target.stat().st_size
    if size > hard_ceiling:
        errors.append(
            f"{path} exceeded the architecture debt ceiling "
            f"({size:,} > {hard_ceiling:,} bytes); extract a coherent responsibility "
            "instead of growing the bootstrap module"
        )
    elif size > warning_threshold:
        warnings.append(
            f"{path} is {size:,} bytes; continue responsibility-based extraction "
            "before scale-driven service splits"
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
        'get("x-request-id")',
        'insert("x-request-id"',
        "Uuid::new_v4()",
        "valid_request_id",
        '"request_completed"',
    ):
        if marker not in source:
            errors.append(f"{path} missing request correlation marker: {marker}")


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
    if source.count('HeaderName::from_static("x-request-id")') < 2:
        errors.append(f"{path} must allow and expose x-request-id through CORS")
    if ".expose_headers([HeaderName::from_static(\"x-request-id\")])" not in source:
        errors.append(f"{path} must expose x-request-id to browser clients")

for marker in (
    "http://alertmanager:9093/-/ready",
    "http://grafana:3000/api/health",
):
    if marker not in prometheus_config:
        errors.append(f"observability self-monitoring probe missing: {marker}")


www_proxy = read("frontend/apps/www/src/proxy.ts")
request_id_helper = read("frontend/apps/www/src/lib/requestId.ts")
community_backend_proxy = read("frontend/apps/www/src/lib/community/backendProxy.ts")
www_http_client = read("frontend/apps/www/src/lib/http/client.ts")
for marker in (
    "resolveRequestId(req.headers.get('x-request-id'))",
    "requestHeaders.set('x-request-id', requestId)",
    "Access-Control-Expose-Headers', 'X-Request-ID'",
    "X-CSRF-Token,X-Request-ID",
):
    if marker not in www_proxy:
        errors.append(f"WWW API correlation contract missing marker: {marker}")
for marker in ("REQUEST_ID_PATTERN", "crypto.randomUUID()"):
    if marker not in request_id_helper:
        errors.append(f"WWW request ID helper missing marker: {marker}")
for marker in ("headers['X-Request-ID'] = requestId", "responseHeaders['x-request-id']"):
    if marker not in community_backend_proxy:
        errors.append(f"Community BFF proxy correlation contract missing marker: {marker}")
if "response.headers.get('x-request-id')" not in www_http_client:
    errors.append("WWW HTTP client must retain backend request IDs on API errors")


for path in (
    "services/identity_service/src/routes/health.rs",
    "services/marketplace_service/src/main.rs",
    "services/community_service/src/main.rs",
):
    source = read(path)
    for marker in (
        "lajukan_outbox_oldest_age_seconds",
        "MIN(created_at)",
        "status <> 'published'",
    ):
        if marker not in source:
            errors.append(f"{path} missing outbox staleness metric marker: {marker}")


for path in (
    "services/identity_service/src/routes/health.rs",
    "services/marketplace_service/src/main.rs",
    "services/community_service/src/main.rs",
):
    source = read(path)
    for marker in (
        "get_max_connections()",
        'state=\\\"active\\\"',
        'state=\\\"max\\\"',
    ):
        if marker not in source:
            errors.append(f"{path} missing DB pool capacity metric marker: {marker}")


for path in (
    "services/identity_service/src/main.rs",
    "services/marketplace_service/src/main.rs",
    "services/community_service/src/main.rs",
):
    source = read(path)
    for marker in ('route("/ready"', 'route("/metrics"', "with_graceful_shutdown"):
        if marker not in source:
            errors.append(f"{path} missing runtime reliability marker: {marker}")


for path in (
    "services/identity_service/src/main.rs",
    "services/marketplace_service/src/main.rs",
    "services/community_service/src/main.rs",
):
    source = read(path)
    for marker in (
        "fn init_tracing()",
        'env::var("LOG_FORMAT")',
        ".json()",
        ".flatten_event(true)",
        ".with_current_span(true)",
        ".with_span_list(true)",
    ):
        if marker not in source:
            errors.append(f"{path} missing structured logging marker: {marker}")

for path in (
    "services/identity_service/Cargo.toml",
    "services/marketplace_service/Cargo.toml",
    "services/community_service/Cargo.toml",
):
    source = read(path)
    if '"json"' not in source:
        errors.append(f"{path} must enable tracing-subscriber JSON logging support")


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
        "FOR UPDATE SKIP LOCKED",
        "status IN ('pending', 'failed', 'processing')",
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

for marker in (
    "probe_surviving_replicas",
    "docker stop --time 10",
    "single-replica failover rehearsal",
    "Refusing multi-replica rehearsal against production",
):
    if marker not in scale_rehearsal_script:
        errors.append(f"staging scale rehearsal missing failover marker: {marker}")

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

for marker in (
    "lajukan:http_requests_per_second:rate5m",
    "lajukan:http_5xx_ratio:rate5m",
    "lajukan:http_5xx_ratio:rate1h",
    "lajukan:http_5xx_ratio:rate6h",
    "LajukanSloFastBurn",
    "LajukanSloSlowBurn",
):
    if marker not in slo_rules_config:
        errors.append(f"SLO recording/alert rules missing: {marker}")

for marker in ("type: prometheus", "url: http://prometheus:9090", "isDefault: true"):
    if marker not in grafana_datasource:
        errors.append(f"Grafana datasource provisioning missing: {marker}")

for marker in ("path: /var/lib/grafana/dashboards", "disableDeletion: true"):
    if marker not in grafana_dashboard_provider:
        errors.append(f"Grafana dashboard provider missing: {marker}")

for marker in (
    "Lajukan Platform Overview",
    "lajukan:http_requests_per_second:rate5m",
    "probe_success",
    "pg_up",
    "rabbitmq_queue_messages_ready",
    "lajukan_outbox_backlog",
    "lajukan_outbox_oldest_age_seconds",
    "lajukan_db_pool_connections",
):
    if marker not in grafana_dashboard:
        errors.append(f"Grafana overview dashboard missing: {marker}")

if '127.0.0.1:${GRAFANA_PORT:-3005}:3000' not in observability_compose:
    errors.append("Grafana must remain loopback-only in the observability overlay")

for warning in warnings:
    print(f"WARNING: {warning}", file=sys.stderr)

if errors:
    for error in errors:
        print(f"ERROR: {error}", file=sys.stderr)
    raise SystemExit(1)

print("Reliability architecture contract OK")
