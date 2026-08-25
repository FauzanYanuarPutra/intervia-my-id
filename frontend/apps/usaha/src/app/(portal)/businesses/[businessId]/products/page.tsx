import { notFound } from 'next/navigation';
import { Boxes, PackagePlus, TriangleAlert } from 'lucide-react';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { ProductQuickForm } from '@/components/forms/ProductQuickForm';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

function stockTone(stockHealth: string | undefined): 'success' | 'warning' | 'danger' | 'neutral' {
  if (stockHealth === 'aman') return 'success';
  if (stockHealth === 'tipis' || stockHealth === 'perlu-cocokkan') return 'warning';
  if (stockHealth === 'habis') return 'danger';
  return 'neutral';
}

function stockLabel(stockHealth: string | undefined) {
  if (stockHealth === 'aman') return 'Aman';
  if (stockHealth === 'tipis') return 'Tipis';
  if (stockHealth === 'habis') return 'Habis';
  if (stockHealth === 'perlu-cocokkan') return 'Perlu cocokkan';
  return 'Belum dinilai';
}

export default async function BusinessProductsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;

  if (!business) notFound();

  const canManage = hasPermission(business, 'manageProducts');
  const attentionCount = (business.lowStockProductsCount ?? 0) + (business.stockCheckCount ?? 0);

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="products">
      <SectionCard
        eyebrow="Katalog"
        title="Produk"
        description="Kelola produk, harga, sumber barang, dan kesehatan stok tanpa kehilangan fokus pada hal yang perlu ditindak."
      >
        <div className="space-y-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Produk aktif" value={business.productsCount} icon={Boxes} note={`${business.ownedProductsCount ?? business.productsCount} stok sendiri`} />
            <StatCard label="Barang titipan" value={business.consignmentProductsCount ?? 0} icon={PackagePlus} note="Produk dengan sumber konsinyasi" />
            <StatCard label="Perlu cek stok" value={attentionCount} icon={TriangleAlert} note={attentionCount ? 'Prioritaskan sebelum menerima order baru' : 'Tidak ada perhatian stok'} />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <DataPanel title="Daftar produk" description={`${business.products.length} produk tercatat pada workspace ini.`}>
              {business.products.length ? (
                <div>
                  <div className="hidden grid-cols-[minmax(220px,1.5fr)_minmax(140px,.8fr)_120px_120px_110px] gap-4 border-b border-portal-line bg-[#fafbf9] px-5 py-3 text-[11px] font-bold text-portal-soft lg:grid">
                    <span>Produk</span><span>Sumber</span><span>Harga</span><span>Stok</span><span>Status</span>
                  </div>
                  <div className="divide-y divide-portal-line">
                    {business.products.map(product => (
                      <article key={product.id} className="px-4 py-4 transition hover:bg-[#fafbf9] sm:px-5">
                        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_minmax(140px,.8fr)_120px_120px_110px] lg:items-center lg:gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-bold tracking-[-0.02em] text-portal-ink">{product.name}</h3>
                              {product.sourceType === 'consignment' ? <StatusBadge tone="info">Titipan</StatusBadge> : null}
                            </div>
                            <p className="mt-1 truncate text-xs text-portal-soft">{product.category}{product.notes ? ` · ${product.notes}` : ''}</p>
                          </div>

                          <div className="text-sm">
                            <p className="font-semibold text-portal-ink">{product.sourceType === 'consignment' ? 'Konsinyasi' : 'Stok sendiri'}</p>
                            <p className="mt-1 text-xs text-portal-soft">{product.ownerLabel ?? (product.sourceType === 'consignment' ? 'Pemilik belum dicatat' : 'Milik usaha')}</p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-portal-soft lg:hidden">Harga</p>
                            <p className="mt-1 text-sm font-bold text-portal-ink lg:mt-0">{product.priceLabel}</p>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-portal-soft lg:hidden">Kondisi stok</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 lg:mt-0">
                              <StatusBadge tone={stockTone(product.stockHealth)}>{stockLabel(product.stockHealth)}</StatusBadge>
                              <span className="text-xs text-portal-soft">{product.stockLabel}</span>
                            </div>
                          </div>

                          <div>
                            <p className="text-[11px] font-semibold text-portal-soft lg:hidden">Status</p>
                            <div className="mt-1 lg:mt-0"><StatusBadge tone={product.status === 'live' ? 'success' : 'neutral'}>{product.status === 'live' ? 'Aktif' : 'Draft'}</StatusBadge></div>
                          </div>
                        </div>

                        {(product.consignmentTerms || product.stockUpdatedAt || product.stockMode === 'estimated') ? (
                          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-portal-soft">
                            {product.consignmentTerms ? <span>Skema: <strong className="font-semibold text-portal-ink">{product.consignmentTerms}</strong></span> : null}
                            {product.stockMode === 'estimated' ? <span>Stok masih berupa estimasi</span> : null}
                            {product.stockUpdatedAt ? <span>Update stok: {product.stockUpdatedAt}</span> : null}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState title="Belum ada produk" description="Tambahkan produk pertama supaya katalog usaha dan halaman pembeli mulai hidup." icon={Boxes} />
              )}
            </DataPanel>

            <DataPanel title={canManage ? 'Tambah produk cepat' : 'Akses katalog'} description={canManage ? 'Masukkan produk inti tanpa meninggalkan halaman katalog.' : 'Peranmu saat ini hanya dapat melihat katalog.'}>
              <div className="p-4 sm:p-5">
                {canManage ? (
                  <ProductQuickForm businessId={business.id} />
                ) : (
                  <p className="text-sm leading-6 text-portal-soft">Tambah atau ubah produk membutuhkan akses owner atau manager.</p>
                )}
              </div>
            </DataPanel>
          </div>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
