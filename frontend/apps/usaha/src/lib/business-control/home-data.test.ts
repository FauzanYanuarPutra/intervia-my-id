import { describe, expect, it, vi } from 'vitest';

import { loadOptionalList } from './home-data';

describe('loadOptionalList', () => {
  it('returns an empty list without calling the loader when the section is disabled', async () => {
    const loader = vi.fn(async () => ['should-not-load']);

    await expect(loadOptionalList(false, loader)).resolves.toEqual([]);
    expect(loader).not.toHaveBeenCalled();
  });

  it('returns loaded data when the optional endpoint succeeds', async () => {
    const loader = vi.fn(async () => ['loaded']);

    await expect(loadOptionalList(true, loader)).resolves.toEqual(['loaded']);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('degrades to an empty list when an optional endpoint fails', async () => {
    const loader = vi.fn(async () => {
      throw new Error('marketplace unavailable');
    });

    await expect(loadOptionalList(true, loader)).resolves.toEqual([]);
  });
});
