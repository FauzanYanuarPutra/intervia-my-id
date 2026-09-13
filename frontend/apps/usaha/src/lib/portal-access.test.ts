import { describe, expect, it } from 'vitest';
import { permissionMap } from './portal-access';

describe('POS role capabilities', () => {
  it('lets cashier sell, review transactions, reprint and close cash without sensitive finance access', () => {
    expect(permissionMap.cashier).toEqual(
      expect.arrayContaining([
        'createSales',
        'viewTransactions',
        'reprintReceipts',
        'closeCashShift',
      ]),
    );
    expect(permissionMap.cashier).not.toEqual(
      expect.arrayContaining([
        'viewCosting',
        'viewFinance',
        'viewTeam',
        'voidSales',
        'refundSales',
      ]),
    );
  });

  it('keeps owner and manager able to perform sensitive POS corrections', () => {
    for (const role of ['owner', 'manager'] as const) {
      expect(permissionMap[role]).toEqual(
        expect.arrayContaining([
          'createSales',
          'viewTransactions',
          'reprintReceipts',
          'closeCashShift',
          'voidSales',
          'refundSales',
        ]),
      );
    }
  });
});
