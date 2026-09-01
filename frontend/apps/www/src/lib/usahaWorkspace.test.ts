import { describe, expect, it } from 'vitest';
import { getUsahaStoreWorkspaceUrl } from './usahaWorkspace';

describe('dedicated Usaha workspace links', () => {
  it('maps legacy owner catalog links to the canonical Usaha product workspace', () => {
    expect(getUsahaStoreWorkspaceUrl('store / 1', 'katalog')).toBe(
      'http://localhost:3003/businesses/store%20%2F%201/products',
    );
  });

  it('keeps the selected business when opening the Usaha dashboard', () => {
    expect(getUsahaStoreWorkspaceUrl('business-1', 'dashboard')).toBe(
      'http://localhost:3003/?business=business-1',
    );
  });

  it('rejects unknown legacy workspace segments instead of losing intent', () => {
    expect(
      getUsahaStoreWorkspaceUrl('business-1', 'workspace-tidak-dikenal'),
    ).toBeNull();
  });
});
