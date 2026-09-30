import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('.', import.meta.url);

function read(name: string) {
  return readFileSync(new URL(name, root), 'utf8');
}

describe('compact workspace rail contract', () => {
  it('keeps horizontal workspace surfaces on the shared Embla rail', () => {
    const tabs = read('WorkspaceTabs.tsx');
    const flow = read('UsahaFlowGuide.tsx');

    expect(tabs).toContain("import { EmblaInlineRail }");
    expect(flow).toContain("import { EmblaInlineRail }");
    expect(tabs).not.toContain('overflow-x-auto');
    expect(flow).not.toContain('overflow-x-auto');
  });

  it('keeps the home shell free of the expanded flow guide', () => {
    const shell = read('PortalShell.tsx');

    expect(shell).toContain('currentSection !== "home"');
    expect(shell).toContain('space-y-3 lg:space-y-4');
  });

  it('keeps the Embla rail dependency aligned with the workspace', () => {
    const packageJson = JSON.parse(
      readFileSync(new URL('../../../../../package.json', root), 'utf8'),
    ) as { dependencies?: Record<string, string> };

    expect(packageJson.dependencies?.['embla-carousel-react']).toBe('^8.6.0');
  });
});
