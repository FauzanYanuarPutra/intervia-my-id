import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/business-control/ChannelSettingsWorkspace.tsx', 'utf8');

describe('channel UX V3', () => {
  it('shows business outcomes before technical settings', () => {
    expect(source).toContain('Harga jual');
    expect(source).toContain('Total potongan');
    expect(source).toContain('Diterima bersih');
    expect(source).toContain('Laba per item');
    expect(source).toContain('Harga aman');
    expect(source).toContain('Atur perhitungan');
    expect(source).toContain('buildChannelBusinessSummary');
  });

  it('preserves costing permissions and readiness messaging', () => {
    expect(source).toContain("readiness !== 'ready'");
    expect(source).toContain('canViewCosting');
    expect(source).toContain('Akses ini tidak menampilkan HPP dan keuntungan');
  });

  it('preserves the existing channel save payload', () => {
    expect(source).toContain('display_name: row.displayName');
    expect(source).toContain('fee_rate_bps: Math.round(row.feePercent * 100)');
    expect(source).toContain('fixed_fee_amount: Math.round(row.fixedFee)');
    expect(source).toContain('merchant_promo_amount: Math.round(row.merchantPromo)');
    expect(source).toContain('target_margin_bps: Math.round(row.targetMarginPercent * 100)');
    expect(source).toContain('enabled: row.enabled');
  });
});
