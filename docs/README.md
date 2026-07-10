# Lajukan Documentation Index

Status: repo audit 2026-07-11.

This documentation system describes what exists in the repository now. It is not a wishlist and not a market research replacement.

## Source Of Truth Order

1. Runtime code.
2. Deployment configuration.
3. Migrations and active schemas.
4. Tests.
5. API clients.
6. Current docs.
7. README.
8. Code comments.
9. Public website.
10. Assumptions.

## Architecture

- `architecture/repository-map.md`
- `architecture/system-architecture.md`
- `architecture/service-catalog.md`
- `architecture/database-map.md`
- `architecture/api-map.md`
- `architecture/event-map.md`
- `architecture/search-architecture.md`
- `architecture/chat-and-whatsapp.md`
- `architecture/community-and-reels.md`
- `architecture/business-profile-and-map.md`
- `architecture/transaction-status.md`
- `architecture/deployment-architecture.md`
- `architecture/crm-architecture.md`
- `architecture/decisions/ADR-0001-crm-owner-internal-boundary.md`

## Product

- `product/product-principles.md`
- `product/cluster-strategy.md`
- `product/current-capabilities.md`
- `product/taxonomy.md`
- `product/crm-strategy.md`
- `product/decision-log.md`
- `product/hypothesis-register.md`

## CRM And Matching

- `crm/CRM_PRODUCT_SPEC.md`
- `crm/AI_MATCHING_ARCHITECTURE.md`
- `crm/CRM_DATA_MODEL.md`
- `crm/CRM_IMPLEMENTATION_PLAN.md`

## Research And Engineering

- `research/evidence-register.md`
- `qa/stabilization-report.md`
- `qa/critical-user-journeys.md`
- `performance/baseline.md`
- `security/security-review.md`
- `engineering/testing-strategy.md`
- `engineering/migration-policy.md`
- `engineering/definition-of-done.md`
- `engineering/technical-debt.md`
- `engineering/refactor-plan.md`
- `engineering/known-risks.md`
- `engineering/lessons-learned.md`

## Existing Specialized Docs

- `lajukan-hidden-routes-audit.md`
- `lajukan-ai-operating-system.md`
- `lajukan-enterprise-operating-blueprint.md`
- `whatsapp-meta-production.md`
- `frontend-usaha-reference.md`

## Maintenance Rule

If code changes product meaning, update the relevant architecture/product doc in the same work item. If the implementation is unclear, mark it as "Needs verification" instead of guessing.
