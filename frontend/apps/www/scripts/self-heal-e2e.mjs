#!/usr/bin/env node
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const MAX_ATTEMPTS = Math.max(1, Number(process.env.SELF_HEAL_MAX_ATTEMPTS || 3));
const PATCH_COMMAND = process.env.SELF_HEAL_PATCH_COMMAND || '';
const RECOVERY_COMMAND = process.env.SELF_HEAL_RECOVERY_COMMAND || '';
const reportDir = resolve(process.cwd(), 'test-results');
const reportFile = resolve(reportDir, 'self-heal-report.md');

mkdirSync(reportDir, { recursive: true });
writeFileSync(
  reportFile,
  `# Playwright Self-Healing Report\n\nStarted: ${new Date().toISOString()}\n\n`,
  'utf8',
);

function run(command, args, label) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    shell: true,
    encoding: 'utf8',
    env: process.env,
  });

  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim();
  appendFileSync(
    reportFile,
    `## ${label}\n\n` +
      '```text\n' +
      `${output.slice(0, 20000)}\n` +
      '```\n\n',
    'utf8',
  );

  return {
    status: result.status ?? 1,
    output,
  };
}

function inferHints(output) {
  const hints = [];
  const o = output.toLowerCase();

  if (o.includes('econnrefused') || o.includes('net::err_connection_refused')) {
    hints.push('Service connection refused: ensure docker services and Next app are running.');
  }
  if (o.includes('timed out') || o.includes('timeout')) {
    hints.push('Timeout detected: inspect slow endpoints and increase readiness checks.');
  }
  if (o.includes('429')) {
    hints.push('Rate limit triggered: use dedicated E2E test users and adjust test pacing.');
  }
  if (o.includes('captcha')) {
    hints.push('Captcha validation failed: configure dev bypass or provide test captcha keys.');
  }

  return hints;
}

let lastOutput = '';

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  const args = ['playwright', 'test'];
  if (attempt > 1) {
    args.push('--last-failed');
  }

  const result = run('npx', args, `Attempt ${attempt}`);
  lastOutput = result.output;

  if (result.status === 0) {
    appendFileSync(
      reportFile,
      `Result: PASS on attempt ${attempt}\n`,
      'utf8',
    );
    console.log(`Self-heal finished: PASS on attempt ${attempt}`);
    process.exit(0);
  }

  const hints = inferHints(result.output);
  if (hints.length > 0) {
    appendFileSync(
      reportFile,
      `### Inferred Hints\n${hints.map((h) => `- ${h}`).join('\n')}\n\n`,
      'utf8',
    );
    console.log('Inferred hints:');
    hints.forEach((hint) => console.log(`- ${hint}`));
  }

  if (RECOVERY_COMMAND) {
    run(RECOVERY_COMMAND, [], `Recovery Command (attempt ${attempt})`);
  }

  if (PATCH_COMMAND) {
    run(PATCH_COMMAND, [], `Patch Command (attempt ${attempt})`);
  }
}

appendFileSync(
  reportFile,
  `Result: FAIL after ${MAX_ATTEMPTS} attempt(s)\n`,
  'utf8',
);

console.error(`Self-heal failed after ${MAX_ATTEMPTS} attempts.`);
if (lastOutput) {
  const preview = lastOutput.split('\n').slice(-20).join('\n');
  console.error(preview);
}
process.exit(1);
