import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stock = readFileSync('src/components/business-control/StockPurchaseYieldWorkspace.tsx', 'utf8');
const settlement = readFileSync('src/components/business-control/SettlementWorkspace.tsx', 'utf8');
const finance = readFileSync('src/components/business-control/FinanceLedger.tsx', 'utf8');
const planning = readFileSync('src/components/business-control/FinancePlanningWorkspace.tsx', 'utf8');
const modifiers = readFileSync('src/components/forms/ProductModifierEditor.tsx', 'utf8');
const settlementRoute = readFileSync('src/app/api/businesses/[businessId]/settlements/route.ts', 'utf8');

describe('Usaha hardening V4 contracts', () => {
  it('uses Jakarta business dates instead of UTC date slicing', () => {
    for (const source of [stock, settlement]) {
      expect(source).toContain('jakartaDateKey');
      expect(source).not.toContain('toISOString().slice(0, 10)');
    }
  });

  it('keeps retry-sensitive writes on client-stable idempotency keys', () => {
    expect(stock).toContain('purchaseAttemptRef');
    expect(stock).toContain("'Idempotency-Key': idempotencyKey");
    expect(finance).toContain('createAttemptRef');
    expect(finance).toContain('correctionAttemptRef');
    expect(finance).toContain('allocationAttemptRef');
    expect(planning).toContain('paymentAttemptRef');
    expect(settlement).toContain('saveAttemptRef');
    expect(settlement).toContain("'Idempotency-Key': attempt.key");
  });

  it('keeps the settlement API backward compatible while forwarding idempotency', () => {
    expect(settlementRoute).toContain("request.headers.get('idempotency-key')");
    expect(settlementRoute).toContain('randomUUID()');
    expect(settlementRoute).toContain('createControlSettlement(businessId, body, idempotencyKey)');
  });

  it('uses visible two-state modifier choices and warns about unsaved edits', () => {
    expect(modifiers).toContain('selectionModeOptions');
    expect(modifiers).toContain('recipeOperationOptions');
    expect(modifiers).toContain('ChoiceChips');
    expect(modifiers).toContain('beforeunload');
    expect(modifiers).toContain('belum disimpan');
    expect(modifiers).not.toMatch(/<select[\s\S]{0,250}value=\{group\.selection_mode\}/);
    expect(modifiers).not.toMatch(/<select[\s\S]{0,250}value=\{effect\.operation\}/);
  });
});
