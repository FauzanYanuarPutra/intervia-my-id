import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

function read(relative: string) {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

describe('portal direct route access contract', () => {
  it('keeps the location editor behind manageInfo even when business info is readable', () => {
    const source = read('../app/(portal)/businesses/[businessId]/locations/page.tsx');
    expect(source).toContain("if (!hasPermission(state.activeBusiness, 'manageInfo'))");
    expect(source).toContain("redirect(`/?business=${encodeURIComponent(state.activeBusiness.id)}`)");
  });

  it('keeps business security events owner-only on direct URL access', () => {
    const source = read('../app/(portal)/security/page.tsx');
    expect(source).toContain("if (scopeBusiness && !hasPermission(scopeBusiness, 'manageSecurity'))");
    expect(source).toContain("redirect(`/?business=${encodeURIComponent(scopeBusiness.id)}`)");
  });

  it('does not offer edit actions from buyer preview to read-only roles', () => {
    const source = read('../app/(portal)/businesses/[businessId]/buyer-page/page.tsx');
    expect(source).toContain("hasPermission(business, 'manageInfo')");
    expect(source).toContain("hasPermission(business, 'manageProducts')");
    expect(source).toContain('canManageInfo ?');
    expect(source).toContain('canManageProducts ?');
  });
});
