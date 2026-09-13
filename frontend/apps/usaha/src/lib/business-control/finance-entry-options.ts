export type FinanceDirection = 'in' | 'out';

export type FinanceEntryOption = {
  value: string;
  label: string;
};

const incomeOptions: FinanceEntryOption[] = [
  { value: 'other_income', label: 'Pendapatan lain' },
  { value: 'capital_income', label: 'Modal masuk' },
];

const expenseOptions: FinanceEntryOption[] = [
  { value: 'inventory_expense', label: 'Belanja stok / bahan' },
  { value: 'payroll_expense', label: 'Gaji karyawan' },
  { value: 'rent_expense', label: 'Sewa kios / tempat' },
  { value: 'utilities_expense', label: 'Listrik / air / internet' },
  { value: 'transport_expense', label: 'Transport / bensin' },
  { value: 'owner_draw', label: 'Ambil owner' },
  { value: 'other_expense', label: 'Pengeluaran lain' },
];

export function financeEntryOptions(direction: FinanceDirection): FinanceEntryOption[] {
  return direction === 'in' ? incomeOptions : expenseOptions;
}

export function financeChannelOptions(channels: Array<{ key: string; label: string }>) {
  return [
    { value: '', label: 'Tidak terkait tempat jualan' },
    ...channels.map(channel => ({ value: channel.key, label: channel.label })),
  ];
}
