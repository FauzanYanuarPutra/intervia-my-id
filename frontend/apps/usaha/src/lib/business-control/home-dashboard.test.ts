import { describe, expect, it } from 'vitest';
import { buildHomeDashboard, type HomePriorityAction } from './home-dashboard';

const action = (priority: number, title: string): HomePriorityAction => ({
  priority,
  title,
  description: `${title} desc`,
  href: '/x',
});

describe('home dashboard', () => {
  it('selects one highest-priority action', () => {
    const result = buildHomeDashboard({
      foundationAction: null,
      nextActions: [action(20, 'Rendah'), action(90, 'Penting'), action(50, 'Sedang')],
      activeSales: 2,
      expenseToday: 45_000,
      stockAttention: 3,
      setupIncomplete: false,
    });
    expect(result.priority.title).toBe('Penting');
  });

  it('puts incomplete foundation before operational suggestions', () => {
    const foundation = action(1_000, 'Lengkapi data utama');
    const result = buildHomeDashboard({
      foundationAction: foundation,
      nextActions: [action(100, 'Isi stok')],
      activeSales: 0,
      expenseToday: 0,
      stockAttention: 0,
      setupIncomplete: true,
    });
    expect(result.priority).toEqual(foundation);
    expect(result.showSetup).toBe(true);
  });

  it('returns a healthy state when nothing needs attention', () => {
    const result = buildHomeDashboard({
      foundationAction: null,
      nextActions: [],
      activeSales: 0,
      expenseToday: 0,
      stockAttention: 0,
      setupIncomplete: false,
    });
    expect(result.priority.title).toBe('Usaha aman. Tidak ada yang mendesak.');
  });

  it('always exposes exactly three compact daily metrics', () => {
    const result = buildHomeDashboard({
      foundationAction: null,
      nextActions: [],
      activeSales: 4,
      expenseToday: 125_000,
      stockAttention: 2,
      setupIncomplete: false,
    });
    expect(result.metrics).toEqual([
      { key: 'sales', label: 'Jualan aktif', value: 4 },
      { key: 'expense', label: 'Pengeluaran hari ini', value: 125_000 },
      { key: 'stock', label: 'Stok perlu perhatian', value: 2 },
    ]);
  });
});
