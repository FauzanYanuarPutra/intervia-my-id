import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workspace = readFileSync(
  'src/components/business-control/SalesHistoryWorkspace.tsx',
  'utf8',
);
const adapter = readFileSync(
  'src/lib/business-control-server.ts',
  'utf8',
);
const route = readFileSync(
  'src/app/api/businesses/[businessId]/sales/[saleId]/void/route.ts',
  'utf8',
);

describe('sale correction contract', () => {
  it('requires an explicit reason and calls the business-scoped void endpoint', () => {
    expect(workspace).toContain('Alasan pembatalan');
    expect(workspace).toContain('reason.trim().length < 3');
    expect(workspace).toContain('/sales/');
    expect(workspace).toContain('/void');
    expect(workspace).toContain('Idempotency-Key');
  });

  it('keeps correction behind the server adapter instead of mutating sales locally', () => {
    expect(adapter).toContain('voidControlSale');
    expect(adapter).toContain("/sales/${encodeURIComponent(saleId)}/void");
    expect(route).toContain('voidControlSale');
    expect(route).toContain('randomUUID()');
  });

  it('preserves the original transaction as history and surfaces the stored reason', () => {
    expect(workspace).toContain('Transaksi asli tetap disimpan');
    expect(workspace).toContain('sale.void_reason');
    expect(workspace).toContain('Transaksi dibatalkan dan jejak koreksinya tersimpan.');
  });
});
