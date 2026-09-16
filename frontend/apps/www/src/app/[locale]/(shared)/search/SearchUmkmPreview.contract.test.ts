import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./SearchUmkmPreview.tsx', import.meta.url)), 'utf8');

describe('Search UMKM preview information hierarchy', () => {
  it('surfaces only real service capabilities and useful business context', () => {
    expect(source).toContain('online_order_enabled');
    expect(source).toContain('offline_order_enabled');
    expect(source).toContain('reservation_enabled');
    expect(source).toContain('available_table_count');
    expect(source).toContain('store.description');
    expect(source).toContain("'Pesan online'");
    expect(source).toContain("'Datang langsung'");
    expect(source).toContain("'Reservasi'");
  });

  it('keeps the business card compact instead of inventing unavailable signals', () => {
    expect(source).not.toContain('Terlaris');
    expect(source).not.toContain('Diskon');
    expect(source).not.toContain('ETA');
  });
});
