import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const dashboard = source('src/components/crm/CrmCommandCenter.tsx');

describe('CRM responsive interaction foundation', () => {
  it('uses the shared select primitive instead of raw selects', () => {
    expect(dashboard).toContain('SelectField');
    expect(dashboard).not.toContain('<select');
  });

  it('keeps mobile navigation and content independently usable', () => {
    expect(dashboard).toContain('lg:hidden');
    expect(dashboard).toContain('h-[100dvh]');
    expect(dashboard).toContain('overflow-y-auto');
  });

  it('keeps the global search accessible', () => {
    expect(dashboard).toContain('aria-label="Cari data CRM"');
    expect(dashboard).toContain('min-h-10');
  });
});
