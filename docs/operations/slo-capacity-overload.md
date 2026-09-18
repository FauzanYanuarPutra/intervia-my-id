# SLO, Capacity and Overload Policy

Status: initial engineering policy, 2026-09-18.

No number in this document is a production claim until it is backed by
production telemetry. Initial targets are engineering targets used to design
tests and alerts.

## Service-level indicators

Critical user journeys should be measured independently:

| Journey | Availability signal | Latency signal |
| --- | --- | --- |
| Public browse/detail | valid non-5xx response | origin p50/p95/p99 |
| Search | valid result or explicit degraded response | search p50/p95/p99 |
| Sign in/session refresh | successful authenticated result | auth p50/p95/p99 |
| Business write | committed canonical state | commit p50/p95/p99 |
| Order/financial write | valid state transition, no duplicate effect | internal time plus provider time separately |
| Chat send/read | accepted/persisted message and delivery/read projection | API plus WebSocket latency separately |
| Media | object accepted/retrieved and reference consistent | upload/download latency |
| Async event | event eventually processed exactly once in business effect | publish lag and consumer lag |

Suggested internal starting objective for core non-AI journeys is 99.9% monthly
availability while enough real telemetry is gathered to set tighter objectives.
Do not advertise this externally until measured.

## Error budget

For every SLO track the remaining monthly error budget. A team that is burning
the budget too quickly prioritizes reliability work over feature rollout on the
affected path.

Alert on burn rate, not only raw error count. Short severe incidents and slower
multi-hour degradation both need detection.

## Latency budget

A request owns a finite deadline. The edge, BFF, service and dependency timeout
must fit inside that deadline.

Example planning shape for a normal interactive request:

```text
client budget          3000 ms
edge/BFF budget        2500 ms
service budget         2000 ms
database/cache         hundreds of ms, not seconds
optional dependency    must leave time for fallback
```

Exact numbers are set from measured traffic. Do not blindly copy the example to
payment, media, AI or long-running export flows.

## Retry budget

Retries can turn a partial incident into a cascading failure.

Rules:

- retry only transient failures;
- retry only idempotent operations or operations protected by an idempotency key;
- cap attempts and total retry time;
- use exponential backoff with jitter;
- do not retry every layer independently;
- expose retry count and exhausted-retry metrics.

For financial/provider calls, an unknown timeout result is not a failed payment
and not a successful payment. Persist the local state and reconcile with the
provider.

## Overload behavior

Protect the source of truth before optional work.

When saturation rises, shed or degrade in this order where product semantics
allow it:

1. expensive recommendation/personalization;
2. AI enrichment and optional inference;
3. non-critical background refresh;
4. passive analytics/event enrichment that is durably recoverable;
5. expensive search facets/secondary ranking;
6. low-priority public reads.

Authentication, authorization, canonical transaction integrity and financial
state transitions are never bypassed as an overload shortcut.

Return explicit 429/503 responses with safe retry guidance rather than allowing
unbounded queues and timeouts.

## Capacity review

Record per workload:

- requests/messages/events per second;
- concurrent requests/WebSockets;
- response-size distribution;
- CPU and memory;
- DB pool active/waiting connections;
- database execution and lock time;
- Redis hit/miss/eviction;
- RabbitMQ queue depth and consumer lag;
- search latency/indexing lag;
- object-storage throughput;
- external provider latency/error rate.

Capacity changes require before/after evidence.

## Scale triggers

Scale vertically when a single instance is healthy but lacks CPU/memory/IO and
the failure domain remains acceptable.

Scale stateless services horizontally when a single process is the measured
capacity/availability limit and the service is proven multi-instance safe.

Add a read replica only when measured reads justify it and consistency semantics
are documented.

Partition/shard only after query/index/pooling/retention/archival improvements
are insufficient or blast-radius isolation itself becomes a requirement.

Move beyond Docker Compose when node count, placement, rollout safety or
self-healing requirements exceed what the team can operate safely with the
current model.

## Test gates

A release that changes a critical hot path should have a representative
staging test for normal load and a documented overload result. Tests must use
synthetic/test identities and must not generate destructive traffic against
production.

The repository read-load harness defaults to loopback intentionally.


## Per-replica database connection budget

Horizontal scaling must budget PostgreSQL connections explicitly. The safe
planning relationship is:

```text
service replicas × DB max connections per replica
+ migration/admin/exporter reserve
< PostgreSQL usable connection budget
```

Identity, Marketplace and Community expose bounded per-replica pool settings
through environment variables. Increasing replica count without lowering or
recalculating these values is not considered a safe scaling action.

Community uses a separate small migration pool so schema migration work does not
reserve the full application pool during rollout. Pool acquire timeout remains
bounded so overload becomes an explicit failure instead of an unbounded wait.
