import { describe, expect, it } from 'vitest';
import { getUsahaPortalBaseUrl } from './umkmSurface';
import { getUsahaStoreWorkspaceUrl } from './usahaWorkspace';

describe('dedicated Usaha workspace links', () => {
  it('maps legacy owner catalog links to the canonical Usaha product workspace', () => {
    expect(getUsahaStoreWorkspaceUrl('store / 1', 'katalog')).toBe(
      'https://usaha.lajukan.com/businesses/store%20%2F%201/products',
    );
  });

  it('keeps the selected business when opening the Usaha dashboard', () => {
    expect(getUsahaStoreWorkspaceUrl('business-1', 'dashboard')).toBe(
      'https://usaha.lajukan.com/?business=business-1',
    );
  });

  it('rejects unknown legacy workspace segments instead of losing intent', () => {
    expect(
      getUsahaStoreWorkspaceUrl('business-1', 'workspace-tidak-dikenal'),
    ).toBeNull();
  });
});


describe('production Usaha origin guard', () => {
  it('falls back to the canonical production origin when no public URL is configured', () => {
    const previous = process.env.NEXT_PUBLIC_USAHA_URL;
    delete process.env.NEXT_PUBLIC_USAHA_URL;
    expect(getUsahaPortalBaseUrl()).toBe('https://usaha.lajukan.com');
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USAHA_URL;
    else process.env.NEXT_PUBLIC_USAHA_URL = previous;
  });

  it('rejects a localhost public URL outside local development', () => {
    const previous = process.env.NEXT_PUBLIC_USAHA_URL;
    process.env.NEXT_PUBLIC_USAHA_URL = 'http://localhost:3003';
    expect(getUsahaPortalBaseUrl()).toBe('https://usaha.lajukan.com');
    if (previous === undefined) delete process.env.NEXT_PUBLIC_USAHA_URL;
    else process.env.NEXT_PUBLIC_USAHA_URL = previous;
  });
});
