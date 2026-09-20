import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calculator, Search, Store } from 'lucide-react';
import { EmptyState } from '@/components/portal/EmptyState';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { ProductThumb } from '@/components/portal/ProductThumb';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { ProductEditorWorkspace } from '@/components/forms/ProductEditorWorkspace';
import { ProductQuickForm } from '@/components/forms/ProductQuickForm';
import { ProductCreateModal } from '@/components/forms/ProductCreateModal';
import { productPrimaryMode } from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ q?: string; stock?: string; edit?: string }>;
};

function stockTone(stockHealth: string | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (stockHealth === 'aman') return 'success';
  if (stockHealth === 'tipis' || stockHealth === 'perlu-cocokkan') return 'warning';
  if (stockHealth === 'habis') return 'danger';
  return 'neutral';
}

function stockLabel(stockHealth: string | undefined) {
  if (stockHealth === 'aman') return 'Aman';
  if (stockHealth === 'tipis') return 'Stok tipis';
  if (stockHealth === 'habis') return 'Habis';
  if (stockHealth === 'perlu-cocokkan') return 'Perlu dicek';
  return 'Belum dinilai';
}

export default async function BusinessProductsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const query = await searchParams;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const resolvedBusinessId = business.id;
  const canManage = hasPermission(business, 'manageProducts');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewChannels = hasPermission(business, 'viewChannels');
  const primaryMode = productPrimaryMode({ productCount: business.products.length, canManage });
  const needle = (query.q ?? '').trim().toLocaleLowerCase('id-ID');
  const attentionOnly = query.stock === 'attention';
  const selectedProduct = canManage
    ? business.products.find(product => product.id === query.edit) ?? null
    : null;
  const visibleProducts = business.products.filter(product => {
    const matchQuery =
      !needle ||
      product.name.toLocaleLowerCase('id-ID').includes(needle) ||
      product.category.toLocaleLowerCase('id-ID').includes(needle);
    const matchStock =
      !attentionOnly ||
      product.stockHealth === 'habis' ||
      product.stockHealth === 'tipis' ||
      product.stockHealth === 'perlu-cocokkan';
    return matchQuery && matchStock;
  });

  function productsHref(options: { edit?: string | null; stock?: string | null } = {}) {
    const search = new URLSearchParams();
    if (query.q) search.set('q', query.q);
    const stock = options.stock === undefined ? query.stock : options.stock;
    if (stock) search.set('stock', stock);
    if (options.edit) search.set('edit', options.edit);
    const suffix = search.toString();
    return `/businesses/${resolvedBusinessId}/products${suffix ? `?${suffix}` : ''}`;
  }

  const listHref = productsHref({ edit: null });

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="products"
    >
      <PageHeader
        eyebrow="Produk"
        title="Produk yang dijual"
        description="Foto, nama, harga, dan stok dulu. Detail lain dibuka saat diperlukan."
        action={canManage ? <ProductCreateModal businessId={business.id} /> : null}
      />

      {primaryMode === 'add-product' ? (
        <section className="merchant-surface-bordered p-4 sm:p-5" id="tambah-produk">
          <h2 className="font-black text-portal-ink">Tambah produk pertama</h2>
          <p className="mt-1 text-xs text-portal-soft">Nama dan harga wajib. Foto dan stok membantu saat jualan.</p>
          <div className="mt-4"><ProductQuickForm businessId={business.id} /></div>
        </section>
      ) : null}

      {business.products.length ? (
        <div className="space-y-4">
          <div className="space-y-4">
            <form className="flex flex-col gap-2 sm:flex-row" action={`/businesses/${business.id}/products`} method="get">
              <label className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-soft" />
                <input name="q" defaultValue={query.q ?? ''} placeholder="Cari produk" className="portal-input w-full pl-10" />
              </label>
              {attentionOnly ? <input type="hidden" name="stock" value="attention" /> : null}
              <div className="flex gap-2 overflow-x-auto">
                <Link href={productsHref({ stock: null })} className={`merchant-chip ${!attentionOnly ? 'merchant-chip-active' : ''}`}>Semua</Link>
                <Link href={productsHref({ stock: 'attention' })} className={`merchant-chip ${attentionOnly ? 'merchant-chip-active' : ''}`}>Stok tipis / habis</Link>
                <button className="portal-button-secondary min-h-9 px-3 py-1.5 text-xs" type="submit">Cari</button>
              </div>
            </form>

            <section className="merchant-list border border-portal-line/80">
              {visibleProducts.length ? visibleProducts.map(product => {
                const selected = product.id === selectedProduct?.id;
                return (
                  <article key={product.id} className={`border-b border-portal-line/70 last:border-b-0 ${selected ? 'bg-portal-mist/60' : ''}`}>
                    <div className="flex items-center gap-3 px-3 py-3 sm:px-4">
                      <ProductThumb name={product.name} imageUrl={product.imageUrl} size="lg" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-sm font-black text-portal-ink sm:text-[15px]">{product.name}</h2>
                          {product.status !== 'live' ? <StatusBadge tone="neutral">Diarsipkan</StatusBadge> : null}
                        </div>
                        <p className="mt-0.5 text-[11px] text-portal-soft">{product.category}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <strong className="text-sm text-portal-ink">{product.priceLabel || 'Belum ada harga'}</strong>
                          <span className="text-xs text-portal-soft">{product.stockLabel} {product.stockUnit ?? ''}</span>
                          <StatusBadge tone={stockTone(product.stockHealth)}>{stockLabel(product.stockHealth)}</StatusBadge>
                        </div>
                      </div>
                      {canManage ? (
                        <Link href={productsHref({ edit: product.id })} className={selected ? 'merchant-chip merchant-chip-active' : 'portal-button-ghost'}>
                          {selected ? 'Dipilih' : 'Kelola'}
                        </Link>
                      ) : null}
                    </div>
                  </article>
                );
              }) : (
                <EmptyState title="Produk tidak ditemukan" description="Coba kata pencarian lain atau tampilkan semua produk." icon={Store} />
              )}
            </section>

            {canManage ? (
              <section className="merchant-surface-bordered flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div>
                  <p className="font-black text-portal-ink">Tambah produk</p>
                  <p className="mt-1 text-xs leading-5 text-portal-soft">
                    Buka form di jendela terpisah supaya daftar produk tetap rapi.
                  </p>
                </div>
                <ProductCreateModal businessId={business.id} />
              </section>
            ) : null}

            {(canViewCosting || canViewChannels) ? (
              <section className="grid gap-2 sm:grid-cols-2">
                {canViewCosting ? (
                  <Link href={`/businesses/${business.id}/products/hpp`} className="merchant-surface-bordered p-4">
                    <Calculator className="h-4 w-4 text-portal-forest" />
                    <p className="mt-2 font-black text-portal-ink">Modal produk (HPP)</p>
                    <p className="mt-1 text-xs leading-5 text-portal-soft">Atur bahan dan biaya saat datanya sudah siap.</p>
                  </Link>
                ) : null}
                {canViewChannels ? (
                  <Link href={`/businesses/${business.id}/channels`} className="merchant-surface-bordered p-4">
                    <Store className="h-4 w-4 text-portal-forest" />
                    <p className="mt-2 font-black text-portal-ink">Harga online</p>
                    <p className="mt-1 text-xs leading-5 text-portal-soft">Atur harga marketplace tanpa memenuhi form produk.</p>
                  </Link>
                ) : null}
              </section>
            ) : null}
          </div>

          {selectedProduct ? (
            <ProductEditorWorkspace
              key={selectedProduct.id}
              businessId={business.id}
              product={selectedProduct}
              closeHref={listHref}
            />
          ) : null}
        </div>
      ) : primaryMode === 'view-only' ? (
        <EmptyState title="Belum ada produk" description="Menambah produk membutuhkan akses yang sesuai." icon={Store} />
      ) : null}
    </PortalShell>
  );
}
