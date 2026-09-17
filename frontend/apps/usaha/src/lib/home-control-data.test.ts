import { describe, expect, it, vi } from 'vitest';

import { settleHomeControlData } from './home-control-data';

describe('settleHomeControlData', () => {
  it('keeps successful dashboard data when one optional source fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const result = await settleHomeControlData({
        ingredients: Promise.resolve([{ id: 'ingredient-1' }]),
        financeEntries: Promise.reject(new Error('finance unavailable')),
        channels: Promise.resolve([{ id: 'channel-1' }]),
      });

      expect(result).toEqual({
        ingredients: [{ id: 'ingredient-1' }],
        financeEntries: [],
        channels: [{ id: 'channel-1' }],
      });
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy.mock.calls[0]?.[0]).toContain('financeEntries');
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('falls back each failed optional source independently', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const result = await settleHomeControlData({
        ingredients: Promise.reject(new Error('ingredients unavailable')),
        financeEntries: Promise.resolve([{ id: 'finance-1' }]),
        channels: Promise.reject(new Error('channels unavailable')),
      });

      expect(result).toEqual({
        ingredients: [],
        financeEntries: [{ id: 'finance-1' }],
        channels: [],
      });
      expect(errorSpy).toHaveBeenCalledTimes(2);
    } finally {
      errorSpy.mockRestore();
    }
  });
});
