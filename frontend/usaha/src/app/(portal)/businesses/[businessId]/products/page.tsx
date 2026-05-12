import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { ProductQuickForm } from '@/components/forms/ProductQuickForm';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessProductsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;

  if (!business) {
    notFound();
  }

  const canManage = hasPermission(business, 'manageProducts');

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="products"
    >
      <SectionCard
        eyebrow="Produk"
        title="Tambah produk yang paling sering dijual"
        description="Katalog inti."
      >
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                Produk aktif
              </p>
              <p className="mt-2 text-xl font-black tracking-[-0.04em] text-portal-ink">
                {business.productsCount}
              </p>
            </div>
            <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                Barang titipan
              </p>
              <p className="mt-2 text-xl font-black tracking-[-0.04em] text-portal-ink">
                {business.consignmentProductsCount ?? 0}
              </p>
            </div>
            <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-portal-soft">
                Perlu cek stok
              </p>
              <p className="mt-2 text-xl font-black tracking-[-0.04em] text-portal-ink">
                {(business.lowStockProductsCount ?? 0) + (business.stockCheckCount ?? 0)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
              <p className="portal-kicker">{canManage ? 'Tambah produk' : 'Mode akses'}</p>
              {canManage ? (
                <div className="mt-4">
                  <ProductQuickForm businessId={business.id} />
                </div>
              ) : (
                <p className="mt-4 text-sm leading-6 text-portal-soft">
                  Peran ini hanya bisa lihat katalog. Tambah atau ubah produk perlu akses owner
                  atau manager.
                </p>
              )}
            </article>

            {business.products.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {business.products.map(product => (
                  <article
                    key={product.id}
                    className="rounded-[24px] border border-portal-line/70 bg-white p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-black tracking-[-0.04em] text-portal-ink">
                          {product.name}
                        </h3>
                        <p className="mt-1 text-sm text-portal-soft">{product.category}</p>
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <span className="rounded-full bg-portal-sand px-3 py-2 text-sm font-semibold text-portal-ink">
                          {product.status === 'live' ? 'Aktif' : 'Draft'}
                        </span>
                        <span className="rounded-full border border-portal-line bg-white px-3 py-2 text-sm font-semibold text-portal-ink">
                          {product.sourceType === 'consignment'
                            ? 'Titipan'
                            : 'Stok warung'}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-portal-soft">
                          Harga
                        </p>
                        <p className="mt-1 text-sm font-semibold text-portal-ink">
                          {product.priceLabel}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-portal-soft">
                          Stok
                        </p>
                        <p className="mt-1 text-sm font-semibold text-portal-ink">
                          {product.stockLabel}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-portal-line/70 bg-white px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-portal-soft">
                          Pemilik barang
                        </p>
                        <p className="mt-1 text-sm font-semibold text-portal-ink">
                          {product.ownerLabel ?? 'Stok warung'}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-portal-line/70 bg-white px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-portal-soft">
                          Status cek stok
                        </p>
                        <p className="mt-1 text-sm font-semibold text-portal-ink">
                          {product.stockHealth === 'aman'
                            ? 'Aman'
                            : product.stockHealth === 'tipis'
                              ? 'Tipis'
                              : product.stockHealth === 'habis'
                                ? 'Habis'
                                : 'Perlu cocokkan'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] border border-portal-line/70 bg-white px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-portal-soft">
                          Mode stok
                        </p>
                        <p className="mt-1 text-sm font-semibold text-portal-ink">
                          {product.stockMode === 'estimated'
                            ? 'Estimasi, perlu cocokkan'
                            : 'Manual, sudah dihitung'}
                        </p>
                      </div>
                      <div className="rounded-[18px] border border-portal-line/70 bg-white px-4 py-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.16em] text-portal-soft">
                          Update terakhir
                        </p>
                        <p className="mt-1 text-sm font-semibold text-portal-ink">
                          {product.stockUpdatedAt ?? '-'}
                        </p>
                      </div>
                    </div>
                    {product.consignmentTerms || product.notes ? (
                      <div className="mt-3 rounded-[18px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3 text-sm text-portal-soft">
                        {product.consignmentTerms ? (
                          <p>
                            Skema titipan: <span className="font-semibold text-portal-ink">{product.consignmentTerms}</span>
                          </p>
                        ) : null}
                        {product.notes ? (
                          <p className={product.consignmentTerms ? 'mt-2' : ''}>
                            Catatan: <span className="font-semibold text-portal-ink">{product.notes}</span>
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-portal-line bg-portal-sand/40 p-6">
                <p className="text-lg font-black tracking-[-0.04em] text-portal-ink">
                  Belum ada produk
                </p>
                <p className="mt-3 text-sm leading-6 text-portal-soft">
                  Tambahkan minimal satu produk supaya halaman pembeli mulai hidup.
                </p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
