import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('public storefront layout contract', () => {
  it('uses a compact food-storefront hierarchy instead of the oversized profile layout', () => {
    expect(source).toContain('data-layout="compact-food-storefront"');
    expect(source).toContain('data-testid="storefront-menu-group"');
    expect(source).toContain('variant="compact"');
  });

  it('keeps brand media proportional without forced hero height or cropped logos', () => {
    expect(source).toContain('aspect-[8/3]');
    expect(source).not.toContain('min-h-[190px]');
    expect(source).not.toContain('sm:min-h-[260px]');
    expect(source).toContain('className="object-contain p-1"');
  });
});
