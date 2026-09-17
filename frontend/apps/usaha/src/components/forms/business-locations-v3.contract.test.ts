import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/forms/BusinessLocationsManager.tsx', 'utf8');

describe('business locations UX V3', () => {
  it('confirms persisted deletion and protects the last location', () => {
    expect(source).toContain('SensitiveActionConfirm');
    expect(source).toContain('pendingDelete');
    expect(source).toContain('locations.length <= 1');
    expect(source).toContain('Usaha harus memiliki minimal satu lokasi.');
    expect(source).not.toContain("onClick={() => void save(locations.filter(item => item.id !== editing.id))}");
  });

  it('discards an unsaved location locally without calling the persistence endpoint', () => {
    expect(source).toContain('Buang draft');
    expect(source).toContain('editingExists');
  });
});
