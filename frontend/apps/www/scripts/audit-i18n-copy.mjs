import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const srcRoot = path.join(root, 'src');
const messageRoot = path.join(srcRoot, 'messages');
const strict = process.argv.includes('--strict');

const LOCALES = ['id', 'en'];
const SOURCE_DIRS = ['app', 'components', 'features'];
const SOURCE_EXTENSIONS = new Set(['.tsx']);
const MAX_EXAMPLES = 16;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listFiles(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        [
          'node_modules',
          '.next',
          'api',
          'test-results',
          'playwright-report',
          '__snapshots__',
        ].includes(entry.name)
      ) {
        continue;
      }
      listFiles(fullPath, predicate, files);
      continue;
    }
    if (predicate(fullPath)) files.push(fullPath);
  }
  return files;
}

function flattenKeys(value, prefix = '', output = new Set()) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    output.add(prefix);
    return output;
  }

  for (const [key, child] of Object.entries(value)) {
    flattenKeys(child, prefix ? `${prefix}.${key}` : key, output);
  }

  return output;
}

function relative(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

function addIssue(bucket, filePath, line, text) {
  bucket.push({
    file: relative(filePath),
    line,
    text: text.replace(/\s+/g, ' ').trim().slice(0, 160),
  });
}

function lineForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function looksUserFacing(text) {
  const cleaned = text
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/&nbsp;|&amp;|&middot;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length < 3) return false;
  if (!/[A-Za-zÀ-ÿ]/.test(cleaned)) return false;
  if (/^[\d\s.,:%/+()#-]+$/.test(cleaned)) return false;
  if (/^(px|rem|vh|vw|true|false|null|undefined)$/i.test(cleaned)) return false;
  return true;
}

function scanSourceFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const hardcodedJsxText = [];
  const hardcodedAttributes = [];
  const manualLocaleBranches = [];
  const seenIssues = new Set();

  function addUniqueIssue(bucket, line, text) {
    const key = `${line}:${text.replace(/\s+/g, ' ').trim()}`;
    if (seenIssues.has(key)) return;
    seenIssues.add(key);
    addIssue(bucket, filePath, line, text);
  }

  const jsxTextPatterns = [
    />\s*([^<>{}\n]*[A-Za-zÀ-ÿ][^<>{}\n]*)\s*<\//g,
    />\s*\r?\n\s*([^<>{}\n]*[A-Za-zÀ-ÿ][^<>{}\n]*)\s*\r?\n\s*<\//g,
  ];
  for (const pattern of jsxTextPatterns) {
    for (const match of source.matchAll(pattern)) {
      const text = match[1];
      if (looksUserFacing(text)) {
        addUniqueIssue(
          hardcodedJsxText,
          lineForIndex(source, match.index),
          text,
        );
      }
    }
  }

  const attributePattern =
    /\b(aria-label|alt|placeholder|title|label)\s*=\s*["']([^"']*[A-Za-zÀ-ÿ][^"']*)["']/g;
  for (const match of source.matchAll(attributePattern)) {
    const text = `${match[1]}="${match[2]}"`;
    if (looksUserFacing(match[2])) {
      addUniqueIssue(
        hardcodedAttributes,
        lineForIndex(source, match.index),
        text,
      );
    }
  }

  const localeBranchPattern =
    /\b(?:isId|locale\s*={0,2}\s*['"]id['"]|chatLocale\s*={0,2}\s*['"]id['"])\s*\?\s*['"`]([^'"`]{3,})['"`]\s*:\s*['"`]([^'"`]{3,})['"`]/g;
  for (const match of source.matchAll(localeBranchPattern)) {
    addUniqueIssue(
      manualLocaleBranches,
      lineForIndex(source, match.index),
      `${match[1]} | ${match[2]}`,
    );
  }

  return { hardcodedJsxText, hardcodedAttributes, manualLocaleBranches };
}

function compareMessageBundles() {
  const namespaces = fs
    .readdirSync(messageRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
    .sort();

  const missingBundles = [];
  const missingKeys = [];
  const totals = [];

  for (const namespace of namespaces) {
    const bundlePaths = Object.fromEntries(
      LOCALES.map(locale => [
        locale,
        path.join(messageRoot, namespace, `${locale}.json`),
      ]),
    );

    for (const locale of LOCALES) {
      if (!fs.existsSync(bundlePaths[locale])) {
        missingBundles.push(`${namespace}/${locale}.json`);
      }
    }

    if (missingBundles.some(item => item.startsWith(`${namespace}/`))) continue;

    const idKeys = flattenKeys(readJson(bundlePaths.id));
    const enKeys = flattenKeys(readJson(bundlePaths.en));
    totals.push({ namespace, id: idKeys.size, en: enKeys.size });

    for (const key of idKeys) {
      if (!enKeys.has(key)) missingKeys.push({ namespace, locale: 'en', key });
    }
    for (const key of enKeys) {
      if (!idKeys.has(key)) missingKeys.push({ namespace, locale: 'id', key });
    }
  }

  return { namespaces, missingBundles, missingKeys, totals };
}

function printExamples(title, issues) {
  console.log(`\n${title}: ${issues.length}`);
  for (const issue of issues.slice(0, MAX_EXAMPLES)) {
    console.log(`- ${issue.file}:${issue.line} ${issue.text}`);
  }
  if (issues.length > MAX_EXAMPLES) {
    console.log(`- ... ${issues.length - MAX_EXAMPLES} more`);
  }
}

const localeReport = compareMessageBundles();
const sourceFiles = SOURCE_DIRS.flatMap(dir =>
  listFiles(path.join(srcRoot, dir), filePath =>
    SOURCE_EXTENSIONS.has(path.extname(filePath)) &&
    !filePath.endsWith('.test.tsx') &&
    !filePath.endsWith('.spec.tsx'),
  ),
);

const scan = {
  hardcodedJsxText: [],
  hardcodedAttributes: [],
  manualLocaleBranches: [],
};

for (const filePath of sourceFiles) {
  const result = scanSourceFile(filePath);
  scan.hardcodedJsxText.push(...result.hardcodedJsxText);
  scan.hardcodedAttributes.push(...result.hardcodedAttributes);
  scan.manualLocaleBranches.push(...result.manualLocaleBranches);
}

console.log('Lajukan i18n/copy audit');
console.log('=======================');
console.log(`Locale namespaces: ${localeReport.namespaces.join(', ')}`);
for (const total of localeReport.totals) {
  console.log(`- ${total.namespace}: id=${total.id}, en=${total.en}`);
}

printExamples('Missing locale bundles', localeReport.missingBundles.map(text => ({ file: text, line: 0, text })));
printExamples(
  'Missing locale keys',
  localeReport.missingKeys.map(item => ({
    file: `${item.namespace}/${item.locale}.json`,
    line: 0,
    text: item.key,
  })),
);
printExamples('Hardcoded JSX text candidates', scan.hardcodedJsxText);
printExamples('Hardcoded text attribute candidates', scan.hardcodedAttributes);
printExamples('Manual locale branch candidates', scan.manualLocaleBranches);

const hasLocaleMismatch =
  localeReport.missingBundles.length > 0 || localeReport.missingKeys.length > 0;
const hasCopyDebt =
  scan.hardcodedJsxText.length > 0 ||
  scan.hardcodedAttributes.length > 0 ||
  scan.manualLocaleBranches.length > 0;

if (hasLocaleMismatch || (strict && hasCopyDebt)) {
  process.exitCode = 1;
}
