export function normalizeMultilineText(value: string): string {
  return value
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\\r\\n', '\n')
    .replaceAll('\\n', '\n')
    .replaceAll('\\t', '\t')
    .replaceAll('\u2028', '\n')
    .replaceAll('\u2029', '\n')
    .replaceAll('\u0000', '')
    .replace(/^\uFEFF/, '')
    .trim();
}
