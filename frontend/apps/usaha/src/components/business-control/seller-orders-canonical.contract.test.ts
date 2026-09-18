import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('src/app/(portal)/businesses/[businessId]/orders/page.tsx', 'utf8');
const inbox = readFileSync('src/components/business-control/OrderInboxWorkspace.tsx', 'utf8');
const server = readFileSync('src/lib/business-control-server.ts', 'utf8');

describe('seller orders canonical contract', () => {
  it('loads the canonical order endpoint instead of business metadata orders', () => {
    expect(page).toContain('listControlOrders');
    expect(page).toContain('canonicalOrders');
    expect(page).not.toContain('orders={business.orders}');
    expect(page).not.toContain('business.orders.filter');
  });

  it('uses backend-authoritative actions with retry and concurrency safety', () => {
    expect(inbox).toContain('allowed_next_statuses');
    expect(inbox).toContain('resolveIdempotencyAttempt');
    expect(inbox).toContain("'Idempotency-Key'");
    expect(inbox).toContain('business_order_version_conflict');
    expect(inbox).toContain('router.refresh()');
  });

  it('keeps the server adapter on business-scoped seller routes', () => {
    expect(server).toContain("businessPath(businessId, '/orders')");
    expect(server).toContain('/transition');
    expect(server).toContain("'Idempotency-Key': idempotencyKey");
  });
});
