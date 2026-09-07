import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const css = readFileSync(resolve(process.cwd(),'tokens.css'),'utf8');
for (const token of ['--color-info','--color-info-soft','--color-info-border','--color-focus','--content-width-sm','--content-width-md','--content-width-lg','--motion-fast','--motion-normal','--touch-target']) {
  it(`defines ${token}`, () => expect(css).toContain(token));
}
