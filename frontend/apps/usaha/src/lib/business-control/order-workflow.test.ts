import { describe, expect, test } from 'vitest';
import { nextOrderAction, orderStatusFilter } from './order-workflow';

describe('order workflow', () => {
  test('maps each active status to one explicit next action', () => {
    expect(nextOrderAction('baru')).toEqual({ label: 'Terima & proses', nextStatus: 'diproses' });
    expect(nextOrderAction('diproses')).toEqual({ label: 'Tandai siap', nextStatus: 'siap kirim' });
    expect(nextOrderAction('siap kirim')).toEqual({ label: 'Selesaikan', nextStatus: 'selesai' });
    expect(nextOrderAction('selesai')).toBeNull();
  });

  test('filters statuses without a generic dropdown model', () => {
    expect(orderStatusFilter('baru', 'semua')).toBe(true);
    expect(orderStatusFilter('baru', 'baru')).toBe(true);
    expect(orderStatusFilter('baru', 'diproses')).toBe(false);
  });
});
