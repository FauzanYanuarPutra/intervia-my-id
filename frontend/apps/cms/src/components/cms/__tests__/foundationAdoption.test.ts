import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe,expect,it } from 'vitest';
const source=readFileSync(resolve(process.cwd(),'src/components/CmsDashboard.tsx'),'utf8');
describe('CMS shared foundation adoption',()=>{
  it('uses shared confirmation and semantic feedback primitives',()=>{
    expect(source).toContain('ConfirmDialog');
    expect(source).toContain('Alert');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<Modal');
  });
  it('uses extracted CMS domain types instead of redefining them',()=>{
    expect(source).not.toContain('type ContentItem = {');
    expect(source).not.toContain('type Sector = {');
    expect(source).not.toContain('type Banner = {');
  });
});
