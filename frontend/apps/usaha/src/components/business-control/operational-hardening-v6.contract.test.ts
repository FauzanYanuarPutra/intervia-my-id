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

  it('keeps cash-shift retries on one client-stable idempotency key', () => {
    const source = read('src/components/business-control/CashShiftWorkspace.tsx');

    expect(source).toContain('resolveIdempotencyAttempt');
    expect(source).toContain('shiftAttemptRef');
    expect(source).toContain("'Idempotency-Key': attempt.key");
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
