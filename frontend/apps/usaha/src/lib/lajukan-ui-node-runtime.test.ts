import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('lajukan-ui server runtime', () => {
  it('loads product configuration through a native Node-safe subpath', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        [
          "import('lajukan-ui/product-configuration')",
          '.then(module => {',
          "  if (typeof module.parseProductModifierGroups !== 'function') process.exit(2);",
          '})',
          '.catch(error => {',
          '  console.error(error);',
          '  process.exit(1);',
          '});',
        ].join('\n'),
      ],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
      },
    );

    expect(result.status, result.stderr || result.stdout).toBe(0);
  });

  it('keeps the authenticated business server off the UI barrel', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/business-server.ts'), 'utf8');

    expect(source).toContain("from 'lajukan-ui/product-configuration'");
    expect(source).not.toContain("from 'lajukan-ui';");
  });
});
