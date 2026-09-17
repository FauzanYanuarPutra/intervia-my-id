export type PosFilterableProduct = {
  category?: string | null;
  isFavorite?: boolean;
};

export type PosFilter = {
  key: string;
  label: string;
};

export function buildPosFilters(products: PosFilterableProduct[]): PosFilter[] {
  const filters: PosFilter[] = [{ key: 'all', label: 'Semua' }];

  if (products.some(product => product.isFavorite)) {
    filters.push({ key: 'favorites', label: 'Favorit' });
  }

  const categories = Array.from(
    new Set(
      products
        .map(product => product.category?.trim())
        .filter((category): category is string => Boolean(category)),
    ),
  ).sort((a, b) => a.localeCompare(b, 'id'));

  filters.push(...categories.map(category => ({ key: `category:${category}`, label: category })));
  return filters;
}

export function productMatchesFilter(product: PosFilterableProduct, filterKey: string) {
  if (filterKey === 'all') return true;
  if (filterKey === 'favorites') return Boolean(product.isFavorite);
  if (filterKey.startsWith('category:')) {
    return product.category?.trim() === filterKey.slice('category:'.length);
  }
  return true;
}

export function buildCashTenderPresets(total: number, suggested: number[]) {
  if (total <= 0) return [];
  return Array.from(new Set([total, ...suggested.filter(amount => amount >= total && amount > 0)])).sort(
    (a, b) => a - b,
  );
}

export function productInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 'PR';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}