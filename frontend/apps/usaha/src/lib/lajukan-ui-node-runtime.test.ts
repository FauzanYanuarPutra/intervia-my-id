import { spawnSync } from 'node:child_process';

describe('lajukan-ui server runtime', () => {
  it('can be imported by native Node ESM from the Usaha server runtime', () => {
    const result = spawnSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        [
          "import('lajukan-ui')",
          ".then(module => {",
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
});
