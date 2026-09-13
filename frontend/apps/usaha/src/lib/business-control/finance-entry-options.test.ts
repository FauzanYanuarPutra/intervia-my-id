import { describe, expect, it } from 'vitest';
import { financeEntryOptions, financeChannelOptions } from './finance-entry-options';

describe('finance entry options', () => {
  it('never offers sale income as a manual money entry and uses backend canonical categories', () => {
    const income = financeEntryOptions('in');
    const expense = financeEntryOptions('out');
    const all = [...income, ...expense];

    expect(all.some(option => option.value === 'sale_income')).toBe(false);
    expect(income.map(option => option.value)).toEqual([
      'other_income',
      'capital_income',
    ]);
    expect(expense.map(option => option.value)).toEqual([
      'inventory_expense',
      'payroll_expense',
      'rent_expense',
      'utilities_expense',
      'transport_expense',
      'owner_draw',
      'other_expense',
    ]);
    expect(Object.fromEntries(expense.map(option => [option.value, option.label]))).toMatchObject({
      inventory_expense: 'Belanja stok / bahan',
      payroll_expense: 'Gaji karyawan',
      rent_expense: 'Sewa kios / tempat',
      utilities_expense: 'Listrik / air / internet',
      transport_expense: 'Transport / bensin',
      owner_draw: 'Ambil owner',
    });
  });

  it('uses configured channels instead of arbitrary free text', () => {
    expect(
      financeChannelOptions([
        { key: 'gofood', label: 'GoFood' },
        { key: 'grabfood', label: 'GrabFood' },
      ]),
    ).toEqual([
      { value: '', label: 'Tidak terkait tempat jualan' },
      { value: 'gofood', label: 'GoFood' },
      { value: 'grabfood', label: 'GrabFood' },
    ]);
  });
});
