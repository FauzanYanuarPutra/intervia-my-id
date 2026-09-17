import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/business-control/FinanceLedgerV2.tsx', 'utf8');

describe('finance ledger UX V3', () => {
  it('uses visible choices and effect previews for common finance work', () => {
    expect(source).toContain('ChoiceChips');
    expect(source).toContain('EffectPreview');
    expect(source).toContain('allocationBalanceAfterMove');
    expect(source).not.toMatch(/<select[\s\S]*?value=\{entryType\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationBucket\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationFrom\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationTo\}/);
    expect(source).toContain('Saldo setelah dipindah');
  });

  it('preserves immutable finance safety contracts', () => {
    expect(source).toContain('Idempotency-Key');
    expect(source).toContain("setCorrectionMode('correct')");
    expect(source).toContain("setCorrectionMode('void')");
    expect(source).toContain('reversal');
    expect(source).toContain('/correct');
  });
});
