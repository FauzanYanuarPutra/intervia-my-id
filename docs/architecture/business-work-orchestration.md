# Business Work Orchestration

Business Work is the human-execution layer above the canonical Business OS domains.

## Ownership

- Identity owns users, organization membership, invitation lifecycle and organization roles.
- Marketplace owns sales, orders, inventory, finance and work items.
- Work items reference source records but never replace the source domain record.

## Work item model

A work item has:

- business and optional location scope;
- work type;
- title and description;
- lifecycle status: `todo`, `in_progress`, `done`, `snoozed`, `cancelled`;
- priority;
- optional assignee;
- optional due time;
- optional source pair (`source_type`, `source_id`);
- audit history through Business Audit Events.

The source pair is unique so condition-driven recommendation synchronization is idempotent.

## Authorization

- Any recognized active organization role may view work.
- Owner/admin/manager may create, assign, reprioritize and otherwise manage work.
- An assigned member may advance the status of their own work.
- Assignment is accepted only for an active business member.

## Recommendation synchronization

The first automatic recommendations are deliberately deterministic:

- ingredient stock at or below minimum -> `restock` work;
- product stock at or below minimum -> `restock` work.

Recommendations do not invent quantities, revenue, cost or stock. They read the canonical inventory records.

## User experience

Usaha exposes work through:

- Home: compact open-work awareness alongside the business snapshot;
- Team & Akses: entry point to the work queue;
- Pekerjaan Usaha: assignment, progress, filters and recommendation refresh.

This layer is intentionally small. It is not a generic project-management product. Its purpose is to turn real business conditions into clear next actions for the people already operating the business.
