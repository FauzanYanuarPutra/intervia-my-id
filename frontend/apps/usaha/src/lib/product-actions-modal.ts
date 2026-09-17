type ProductListQuery = {
  businessId: string;
  q?: string | string[];
  stock?: string | string[];
  productAction?: string | string[];
};

type ProductActionQuery = ProductListQuery & {
  productId: string;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function productListParams(query: ProductListQuery) {
  const params = new URLSearchParams();
  const q = firstParam(query.q)?.trim();
  const stock = firstParam(query.stock)?.trim();

  if (q) params.set('q', q);
  if (stock) params.set('stock', stock);

  return params;
}

function productListPath(businessId: string) {
  return `/businesses/${encodeURIComponent(businessId)}/products`;
}

function withParams(path: string, params: URLSearchParams) {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function buildProductsHref(query: ProductListQuery) {
  return withParams(productListPath(query.businessId), productListParams(query));
}

export function buildProductActionHref(query: ProductActionQuery) {
  const params = productListParams(query);
  params.set('productAction', query.productId);
  return withParams(productListPath(query.businessId), params);
}
