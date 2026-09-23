import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const dashboard = source('src/components/CmsDashboard.tsx');
const controlCenter = source('src/components/CmsControlCenter.tsx');
const login = source('src/app/login/page.tsx');

describe('CMS responsive interaction foundation', () => {
  it('uses the shared select primitive across editorial workspaces', () => {
    expect(dashboard).toContain('SelectField');
    expect(controlCenter).toContain('SelectField');
    expect(dashboard).not.toContain('<select');
    expect(controlCenter).not.toContain('<select');
  });

  it('keeps dashboard layouts responsive instead of relying on fixed desktop widths', () => {
    expect(dashboard).toContain('md:grid-cols-4');
    expect(dashboard).toContain('xl:');
    expect(controlCenter).toContain('xl:grid-cols-');
  });

  it('keeps the login shell touch-friendly and accessible', () => {
    expect(login).toContain('min-h-[100dvh]');
    expect(login).toContain('min-h-11');
    expect(login).toContain('role="alert"');
    expect(login).toContain('focus-visible:ring-2');
  });
});
