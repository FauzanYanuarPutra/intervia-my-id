export type FinanceDirection = 'in' | 'out';

export type FinanceEntryOption = {
  value: string;
  label: string;
};

const incomeOptions: FinanceEntryOption[] = [
  { value: 'other_income', label: 'Pendapatan lain' },
  { value: 'owner_capital', label: 'Modal pemilik' },
  { value: 'receivable_payment', label: 'Piutang dibayar' },
];

const expenseOptions: FinanceEntryOption[] = [
  { value: 'ingredient_purchase', label: 'Belanja bahan' },
  { value: 'packaging_purchase', label: 'Belanja kemasan' },
  { value: 'rent', label: 'Sewa' },
  { value: 'utilities', label: 'Listrik / air / internet' },
  { value: 'salary', label: 'Gaji' },
  { value: 'transport', label: 'Transport' },
  { value: 'marketing', label: 'Promosi' },
  { value: 'equipment', label: 'Peralatan' },
  { value: 'payable_payment', label: 'Bayar utang' },
  { value: 'owner_drawing', label: 'Ambil pribadi' },
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
