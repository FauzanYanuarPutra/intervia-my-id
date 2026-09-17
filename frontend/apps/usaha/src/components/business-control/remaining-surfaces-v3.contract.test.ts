import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const paths = {
  info: 'src/app/(portal)/businesses/[businessId]/info/page.tsx',
  operations: 'src/app/(portal)/businesses/[businessId]/operations/page.tsx',
  buyerPage: 'src/app/(portal)/businesses/[businessId]/buyer-page/page.tsx',
  reports: 'src/app/(portal)/businesses/[businessId]/reports/page.tsx',
};

const files = Object.fromEntries(
  Object.entries(paths).map(([key, path]) => [key, readFileSync(path, 'utf8')]),
) as Record<keyof typeof paths, string>;

describe('remaining Usaha UX V3 surfaces', () => {
  it('keeps audited read-first pages free of blocking workflow modals', () => {
    for (const source of Object.values(files)) {
      expect(source).not.toContain('ModalSurface');
    }
  });

  it('keeps reports read-oriented instead of turning it into a data-entry form', () => {
    expect(files.reports).toContain('MetricStrip');
    expect(files.reports).not.toContain('<form');
  });

  it('keeps operations focused on status and actionable stock issues', () => {
    expect(files.operations).toContain('OperationsQuickForm');
    expect(files.operations).toContain('Perlu ditangani');
  });
});
