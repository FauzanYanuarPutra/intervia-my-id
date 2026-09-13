import { describe, expect, it } from 'vitest';
import { financeEntryOptions, financeChannelOptions } from './finance-entry-options';

describe('finance entry options', () => {
  it('never offers sale income as a manual money entry', () => {
    const all = [...financeEntryOptions('in'), ...financeEntryOptions('out')];
    expect(all.some(option => option.value === 'sale_income')).toBe(false);
    expect(financeEntryOptions('in')[0]?.value).toBe('other_income');
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
