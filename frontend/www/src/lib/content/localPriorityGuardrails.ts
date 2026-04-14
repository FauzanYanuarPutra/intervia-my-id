const LOCAL_PRIORITY_FIELD_KEYS = [
  'title',
  'summary',
  'body',
  'tags',
  'brand',
  'company_name',
  'website',
  'model_name',
] as const;

const FOREIGN_BRAND_GUARDRAIL_TERMS = [
  ['nike', 'Nike'],
  ['adidas', 'Adidas'],
  ['apple', 'Apple'],
  ['iphone', 'iPhone'],
  ['macbook', 'MacBook'],
  ['samsung', 'Samsung'],
  ['xiaomi', 'Xiaomi'],
  ['oppo', 'Oppo'],
  ['vivo', 'Vivo'],
  ['huawei', 'Huawei'],
  ['asus', 'Asus'],
  ['lenovo', 'Lenovo'],
  ['uniqlo', 'Uniqlo'],
  ['zara', 'Zara'],
  ['h&m', 'H&M'],
  ['shein', 'Shein'],
  ['ikea', 'IKEA'],
  ['starbucks', 'Starbucks'],
  ['coca-cola', 'Coca-Cola'],
  ['pepsi', 'Pepsi'],
  ['toyota', 'Toyota'],
  ['honda', 'Honda'],
] as const;

function normalizeGuardrailText(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) {
    return value.map(entry => normalizeGuardrailText(entry)).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>)
      .map(entry => normalizeGuardrailText(entry))
      .join(' ');
  }
  return String(value).trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function detectForeignBrandSignals(
  values: Record<string, unknown>,
): string[] {
  const haystack = LOCAL_PRIORITY_FIELD_KEYS.map(key =>
    normalizeGuardrailText(values[key]).toLowerCase(),
  )
    .filter(Boolean)
    .join('\n');

  if (!haystack) return [];

  return FOREIGN_BRAND_GUARDRAIL_TERMS.filter(([term]) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegExp(term.toLowerCase())}(?=$|[^a-z0-9])`, 'i').test(
      haystack,
    ),
  ).map(([, label]) => label);
}

export function formatForeignBrandSignalSummary(
  matches: string[],
  locale: string,
): string {
  const names = matches.slice(0, 3).join(', ');
  const extra = matches.length - 3;
  const suffix =
    extra > 0
      ? locale === 'id'
        ? ` +${extra} lagi`
        : ` +${extra} more`
      : '';

  return `${names}${suffix}`;
}

