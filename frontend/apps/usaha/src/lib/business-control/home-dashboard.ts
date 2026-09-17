export type HomePriorityAction = {
  priority: number;
  title: string;
  description: string;
  href: string;
};

export type HomeMetric = {
  key: 'sales' | 'expense' | 'stock';
  label: string;
  value: number;
};

export function buildHomeDashboard(input: {
  foundationAction: HomePriorityAction | null;
  nextActions: HomePriorityAction[];
  activeSales: number;
  expenseToday: number;
  stockAttention: number;
  setupIncomplete: boolean;
}) {
  const sorted = [...input.nextActions].sort((left, right) => right.priority - left.priority);
  const priority =
    input.foundationAction ??
    sorted[0] ?? {
      priority: 0,
      title: 'Usaha aman. Tidak ada yang mendesak.',
      description: 'Lanjutkan jualan dan catat kejadian usaha saat benar-benar terjadi.',
      href: '#quick-actions',
    };

  const metrics: HomeMetric[] = [
    { key: 'sales', label: 'Jualan aktif', value: Math.max(0, input.activeSales) },
    { key: 'expense', label: 'Pengeluaran hari ini', value: Math.max(0, input.expenseToday) },
    { key: 'stock', label: 'Stok perlu perhatian', value: Math.max(0, input.stockAttention) },
  ];

  return {
    priority,
    metrics,
    showSetup: input.setupIncomplete,
  };
}
