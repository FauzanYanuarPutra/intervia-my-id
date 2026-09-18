import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('Usaha operational hardening V6', () => {
  it('keeps ingredient stock retries on one client-stable idempotency key', () => {
    const route = read('src/app/api/businesses/[businessId]/ingredients/[ingredientId]/stock-adjustments/route.ts');
    const workspace = read('src/components/business-control/IngredientWorkspace.tsx');

    expect(route).toContain("request.headers.get('idempotency-key')");
    expect(route).toContain('idempotencyKey');
    expect(route).not.toContain('randomUUID()');

    expect(workspace).toContain('resolveIdempotencyAttempt');
    expect(workspace).toContain('stockAttemptRef');
    expect(workspace).toContain("'Idempotency-Key': attempt.key");
  });

  it('keeps cash-shift retries idempotent from browser through persistence', () => {
    const workspace = read('src/components/business-control/CashShiftWorkspace.tsx');
    const proxy = read('src/app/api/businesses/[businessId]/wave2/route.ts');
    const server = read('src/lib/business-wave2-server.ts');
    const rustRoutes = read('../../../services/marketplace_service/src/businesses/wave2_routes.rs');
    const rustRepo = read('../../../services/marketplace_service/src/businesses/wave2.rs');
    const migration = read('../../../services/marketplace_service/migrations/20260918170000_cash_shift_idempotency.up.sql');

    expect(workspace).toContain('resolveIdempotencyAttempt');
    expect(workspace).toContain('shiftAttemptRef');
    expect(workspace).toContain("'Idempotency-Key': attempt.key");

    expect(proxy).toContain("request.headers.get('idempotency-key')");
    expect(proxy).toContain("{ error: 'missing_idempotency_key' }");
    expect(proxy).toContain('openWave2CashShift(businessId, idempotencyKey');
    expect(proxy).toContain('closeWave2CashShift(businessId, shiftId, idempotencyKey');
    expect(proxy).not.toMatch(/open_cash_shift[\s\S]{0,500}randomUUID\(\)/);
    expect(proxy).not.toMatch(/close_cash_shift[\s\S]{0,500}randomUUID\(\)/);

    expect(server).toContain('idempotencyKey: string');
    expect(server).toContain("headers: { 'Idempotency-Key': idempotencyKey }");

    expect(rustRoutes).toContain('parse_idempotency_key(&headers)');
    expect(rustRoutes).toContain('idempotency_key');

    expect(rustRepo).toContain('open_idempotency_key');
    expect(rustRepo).toContain('open_request_hash');
    expect(rustRepo).toContain('close_idempotency_key');
    expect(rustRepo).toContain('close_request_hash');
    expect(rustRepo).toContain('replayed');

    expect(migration).toContain('open_idempotency_key');
    expect(migration).toContain('open_request_hash');
    expect(migration).toContain('close_idempotency_key');
    expect(migration).toContain('close_request_hash');
  });

  it('requires client-stable idempotency keys for all Wave2 money and stock effects', () => {
    const proxy = read('src/app/api/businesses/[businessId]/wave2/route.ts');
    const finance = read('src/components/business-control/FinancePlanningWorkspace.tsx');
    const stock = read('src/components/business-control/StockPurchaseYieldWorkspace.tsx');

    expect(proxy).not.toContain('randomUUID');
    expect(proxy.match(/missing_idempotency_key/g)?.length ?? 0).toBeGreaterThanOrEqual(6);

    for (const action of [
      'create_obligation',
      'pay_obligation',
      'purchase',
      'open_cash_shift',
      'close_cash_shift',
      'create_yield_observation',
    ]) {
      expect(proxy).toContain(`action === '${action}'`);
    }

    expect(finance).toContain('resolveIdempotencyAttempt');
    expect(finance).toContain("'Idempotency-Key': attempt.key");
    expect(stock).toContain('resolveIdempotencyAttempt');
    expect(stock).toContain('attempt.key');
  });

  it('normalizes remaining async API errors before presenting them to users', () => {
    const files = [
      'src/components/business-control/DurableHppWorkspace.tsx',
      'src/components/business-control/OrderInboxWorkspace.tsx',
      'src/components/business-control/QuickSaleWorkspace.tsx',
      'src/components/media/BusinessImageCropUpload.tsx',
      'src/components/portal/PendingOrganizationInvitations.tsx',
    ];

    for (const file of files) {
      const source = read(file);
      expect(source, file).toContain('businessApiErrorMessage');
      expect(source, file).not.toMatch(/(?:payload|body|result)\??\.error\s*\|\|/);
    }
  });

  it('supports keyboard navigation in searchable entity pickers', () => {
    const source = read('src/components/interaction/SearchPicker.tsx');

    expect(source).toContain('onKeyDown');
    expect(source).toContain('aria-activedescendant');
    expect(source).toContain("event.key === 'ArrowDown'");
    expect(source).toContain("event.key === 'ArrowUp'");
    expect(source).toContain("event.key === 'Enter'");
    expect(source).toContain("event.key === 'Escape'");
  });
});
