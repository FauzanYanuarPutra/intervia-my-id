import { asString, type ContentItem } from './catalog';

type LocaleCode = 'id' | 'en';

const SUPPLIER_ROLE_LABELS: Record<
  string,
  { id: string; en: string }
> = {
  product_only: { id: 'Produk', en: 'Product' },
  supplier_first_hand: { id: 'Supplier tangan pertama', en: 'First-hand supplier' },
  supplier_non_first_hand: {
    id: 'Supplier non tangan pertama',
    en: 'Non-first-hand supplier',
  },
  manufacturer: { id: 'Produsen', en: 'Manufacturer' },
  distributor: { id: 'Distributor', en: 'Distributor' },
  reseller: { id: 'Reseller', en: 'Reseller' },
  retailer: { id: 'Retailer', en: 'Retailer' },
  farmer: { id: 'Petani', en: 'Farmer' },
  breeder: { id: 'Peternak', en: 'Breeder' },
  other: { id: 'Lainnya', en: 'Other' },
};

function normalizeText(value: unknown): string {
  return asString(value)?.toLowerCase().trim() || '';
}

export function normalizeSupplierRole(value: unknown): string {
  const raw = normalizeText(value);
  if (!raw) return '';

  const compact = raw
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!compact) return '';
  if (
    compact.includes('produk') ||
    compact.includes('product only') ||
    compact.includes('product-only') ||
    compact === 'product'
  ) {
    return 'product_only';
  }
  if (
    compact.includes('tangan pertama') ||
    compact.includes('first hand') ||
    compact.includes('first-hand') ||
    compact.includes('firsthand')
  ) {
    return 'supplier_first_hand';
  }
  if (
    compact.includes('bukan tangan pertama') ||
    compact.includes('non first hand') ||
    compact.includes('non-first-hand') ||
    compact.includes('non first-hand') ||
    compact.includes('second hand') ||
    compact.includes('second-hand')
  ) {
    return 'supplier_non_first_hand';
  }
  if (compact.includes('produsen') || compact.includes('manufacturer'))
    return 'manufacturer';
  if (compact.includes('distributor')) return 'distributor';
  if (compact.includes('reseller')) return 'reseller';
  if (compact.includes('retailer')) return 'retailer';
  if (compact.includes('petani') || compact.includes('farmer'))
    return 'farmer';
  if (compact.includes('peternak') || compact.includes('breeder'))
    return 'breeder';
  if (compact.includes('supplier')) return 'supplier_non_first_hand';
  return normalizeText(raw).replace(/[^a-z0-9_-]+/g, '_').slice(0, 40);
}

function readSupplierRoleValue(item: ContentItem): string {
  const metadata = item.metadata || {};
  return (
    asString(item.seller_type) ||
    asString(metadata.seller_type) ||
    asString(metadata.supplier_type) ||
    asString(metadata.seller_role) ||
    asString(metadata.listing_role) ||
    asString(metadata.role) ||
    ''
  );
}

function readMinimumOrderValue(item: ContentItem): string {
  const metadata = item.metadata || {};
  return (
    asString(item.minimum_order) ||
    asString(metadata.minimum_order) ||
    asString(metadata.moq) ||
    asString(metadata.minimum_order_qty) ||
    ''
  );
}

export function resolveSupplierRoleLabel(
  role: unknown,
  locale: LocaleCode,
): string {
  const normalized = normalizeSupplierRole(role);
  if (!normalized) return '';
  const mapped = SUPPLIER_ROLE_LABELS[normalized] || SUPPLIER_ROLE_LABELS.other;
  return locale === 'id' ? mapped.id : mapped.en;
}

export function resolveSupplierListingBadges(
  item: ContentItem,
  locale: LocaleCode,
): string[] {
  const role = normalizeSupplierRole(readSupplierRoleValue(item));
  const minimumOrder = readMinimumOrderValue(item);
  const badges: string[] = [];
  const isId = locale === 'id';

  if (role === 'product_only') {
    badges.push(isId ? 'Produk' : 'Product');
  } else if (role === 'supplier_first_hand') {
    badges.push(isId ? 'Supplier' : 'Supplier');
    badges.push(isId ? 'Tangan pertama' : 'First-hand');
  } else if (role === 'supplier_non_first_hand') {
    badges.push(isId ? 'Supplier' : 'Supplier');
    badges.push(isId ? 'Bukan tangan pertama' : 'Not first-hand');
  } else {
    const roleLabel = resolveSupplierRoleLabel(role, locale);
    if (roleLabel) badges.push(roleLabel);
  }

  if (minimumOrder) {
    badges.push(isId ? `MOQ ${minimumOrder}` : `MOQ ${minimumOrder}`);
  }

  return badges;
}
