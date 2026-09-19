import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

function read(path: string) {
  return readFileSync(path, 'utf8');
}

describe('Usaha operational hardening', () => {
  it('does not expose raw API error codes in core money and stock workflows', () => {
    const files = [
      'src/components/business-control/FinanceLedger.tsx',
      'src/components/business-control/FinancePlanningWorkspace.tsx',
      'src/components/business-control/SettlementWorkspace.tsx',
      'src/components/business-control/StockPurchaseYieldWorkspace.tsx',
      'src/components/business-control/ChannelSettingsWorkspace.tsx',
      'src/components/forms/ProductEditorWorkspace.tsx',
      'src/components/forms/ProductModifierEditor.tsx',
      'src/components/forms/BusinessLocationsManager.tsx',
      'src/components/forms/NewBusinessQuickForm.tsx',
      'src/components/forms/ProductQuickFormSimple.tsx',
      'src/components/forms/ReconcileBusinessButton.tsx',
    ];

    for (const file of files) {
      const source = read(file);
      expect(source, file).toContain('businessApiErrorMessage');
      expect(source, file).not.toMatch(/throw new Error\([^\n]*(?:payload|body|result)\??\.error\s*\|\|/);
    }
  });

  it('resets product editor state when a different product is selected', () => {
    const page = read('src/app/(portal)/businesses/[businessId]/products/page.tsx');
    expect(page).toContain('key={selectedProduct.id}');
  });

  it('uses assertive announcements for cashier failures', () => {
    const source = read('src/components/business-control/QuickSaleWorkspace.tsx');
    expect(source).toContain('role="alert"');
    expect(source).toContain('Kosongkan pesanan?');
    expect(source).toContain('SensitiveActionConfirm');
    expect(source).toContain('aria-live="assertive"');
  });

  it('requires a reason when changing core business information', () => {
    const source = read('src/components/forms/BusinessInfoQuickForm.tsx');
    expect(source).toContain('reason.trim().length < 3');
    expect(source).toContain('reason: reason.trim()');
    expect(source).toContain('Catatan perubahan');
  });

  it('shows business audit details as before and after when available', () => {
    const source = read('src/components/portal/ChangeHistoryDrawer.tsx');
    expect(source).toContain('Lihat detail perubahan');
    expect(source).toContain('Sebelum');
    expect(source).toContain('Sesudah');
    expect(source).toContain('readChanges');
  });

  it('keeps product archiving behind a sensitive confirmation', () => {
    const source = read('src/components/forms/ProductEditorWorkspace.tsx');
    expect(source).toContain('SensitiveActionConfirm');
    expect(source).toContain('Arsipkan produk?');
  });
});
