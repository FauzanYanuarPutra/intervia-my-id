import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const sourceRoot = path.join(projectRoot, 'src');
const baselinePath = path.join(scriptDirectory, 'source-health-baseline.json');
const legacyLimits = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const newFileLimit = 1_200;
const violations = [];
const improvements = [];

function normalizedRelativePath(filePath) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
  });
}

for (const filePath of sourceFiles(sourceRoot)) {
  const source = fs.readFileSync(filePath, 'utf8');
  const lineCount = source.split(/\r?\n/).length;
  const relativePath = normalizedRelativePath(filePath);
  const legacyLimit = legacyLimits[relativePath];

  if (legacyLimit && lineCount > legacyLimit) {
    violations.push(
      `${relativePath}: ${lineCount} lines exceeds its frozen ${legacyLimit}-line ceiling`,
    );
  } else if (!legacyLimit && lineCount > newFileLimit) {
    violations.push(
      `${relativePath}: ${lineCount} lines; split new source files above ${newFileLimit} lines`,
    );
  } else if (legacyLimit && lineCount <= newFileLimit) {
    improvements.push(`${relativePath}: remove this recovered file from the baseline`);
  }

  if (/userScalable\s*:\s*false|user-scalable\s*=\s*no/i.test(source)) {
    violations.push(`${relativePath}: browser zoom must remain available`);
  }
}

const { buildContentSecurityPolicy } = await import(
  pathToFileURL(
    path.resolve(projectRoot, '../../packages/config/nextSecurityHeaders.mjs'),
  ).href
);
const sharedSecurityConfig = buildContentSecurityPolicy();
for (const directive of [
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
]) {
  if (!sharedSecurityConfig.includes(directive)) {
    violations.push(`shared security policy is missing ${directive}`);
  }
}

if (improvements.length > 0) {
  console.log(`Source health improvements:\n- ${improvements.join('\n- ')}`);
}

if (violations.length > 0) {
  console.error(`Source health failed:\n- ${violations.join('\n- ')}`);
  process.exit(1);
}

console.log(
  `Source health passed: ${Object.keys(legacyLimits).length} legacy ceilings are frozen; new files are capped at ${newFileLimit} lines.`,
);
