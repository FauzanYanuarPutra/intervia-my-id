import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, Calculator, PackagePlus, Store, TriangleAlert } from 'lucide-react';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { ProductManageForm } from '@/components/forms/ProductManageForm';
import { ProductQuickForm } from '@/components/forms/ProductQuickForm';
import { productPrimaryMode } from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

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
  if (stockHealth === 'perlu-cocokkan') return 'Perlu dicek';
  return 'Belum dinilai';
}

export default async function BusinessProductsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManage = hasPermission(business, 'manageProducts');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewChannels = hasPermission(business, 'viewChannels');
  const primaryMode = productPrimaryMode({ productCount: business.products.length, canManage });
  const activeProductsCount = business.products.filter(product => product.status === 'live').length;
  const attentionCount = (business.lowStockProductsCount ?? 0) + (business.stockCheckCount ?? 0);

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="products">
      <SectionCard eyebrow="Produk" title="Produk yang kamu jual" description="Lihat nama, harga, stok, dan status lebih dulu. Detail modal dan pengaturan lainnya dibuka hanya saat dibutuhkan.">
        <div className="space-y-4">
          {primaryMode === 'add-product' ? (
            <DataPanel title="Tambah produk pertama" description="Isi nama dan harga jual dulu. Modal produk bisa dilengkapi setelah produk tersimpan.">
              <div className="p-4 sm:p-5"><ProductQuickForm businessId={business.id} /></div>
            </DataPanel>
          ) : null}

          {business.products.length ? (
            <>
              <section className="grid gap-2 sm:grid-cols-3">
                <StatCard label="Produk aktif" value={activeProductsCount} icon={Boxes} note={`${business.products.length} produk tercatat`} />
                <StatCard label="Barang titipan" value={business.consignmentProductsCount ?? 0} icon={PackagePlus} note="Jika usahamu menerima barang titipan" />
                <StatCard label="Stok perlu dicek" value={attentionCount} icon={TriangleAlert} note={attentionCount ? 'Cek sebelum kehabisan' : 'Tidak ada peringatan stok'} />
              </section>

              <DataPanel title="Daftar produk" description="Ketuk detail hanya ketika kamu ingin mengubah produk atau melihat pengaturan lanjut.">
                <div className="divide-y divide-portal-line">
                  {business.products.map(product => (
                    <article key={product.id} className="px-4 py-3.5 sm:px-5">
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(120px,.7fr)_minmax(110px,.6fr)_auto] sm:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div
                            className="h-11 w-11 shrink-0 rounded-xl border border-portal-line bg-[#f3f5f1] bg-cover bg-center"
                            style={product.imageUrl ? { backgroundImage: `url(${product.imageUrl})` } : undefined}
                            role="img"
                            aria-label={product.imageUrl ? `Foto ${product.name}` : 'Foto produk belum diunggah'}
                          />
                          <div className="min-w-0">
                            <h3 className="truncate font-bold tracking-[-0.02em] text-portal-ink">{product.name}</h3>
                            <p className="mt-0.5 truncate text-xs text-portal-soft">{product.category}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold text-portal-soft sm:hidden">Harga</p>
                          <p className="text-sm font-bold text-portal-ink">{product.priceLabel || 'Belum ada harga'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge tone={stockTone(product.stockHealth)}>{stockLabel(product.stockHealth)}</StatusBadge>
                          <span className="text-xs text-portal-soft">{product.stockLabel}</span>
                        </div>
                        <StatusBadge tone={product.status === 'live' ? 'success' : 'neutral'}>{product.status === 'live' ? 'Aktif' : 'Diarsipkan'}</StatusBadge>
                      </div>

                      <details className="mt-2 border-t border-portal-line/60 pt-2">
                        <summary className="cursor-pointer list-none text-xs font-bold text-portal-forest">Detail & pengaturan</summary>
                        <div className="mt-3 rounded-xl bg-[#fafbf9] p-3">
                          <dl className="grid gap-3 text-xs sm:grid-cols-3">
                            <div><dt className="text-portal-soft">Sumber barang</dt><dd className="mt-1 font-semibold text-portal-ink">{product.sourceType === 'consignment' ? 'Barang titipan' : 'Milik usaha'}</dd></div>
                            <div><dt className="text-portal-soft">Pemilik</dt><dd className="mt-1 font-semibold text-portal-ink">{product.ownerLabel ?? (product.sourceType === 'consignment' ? 'Belum dicatat' : 'Usaha')}</dd></div>
                            <div><dt className="text-portal-soft">Update stok</dt><dd className="mt-1 font-semibold text-portal-ink">{product.stockUpdatedAt || 'Belum tercatat'}</dd></div>
                          </dl>
                          {product.consignmentTerms ? <p className="mt-3 text-xs text-portal-soft">Ketentuan barang titipan: <strong className="text-portal-ink">{product.consignmentTerms}</strong></p> : null}
                          {product.stockMode === 'estimated' ? <p className="mt-2 text-xs text-amber-700">Jumlah stok masih berupa perkiraan. Cocokkan dengan kondisi nyata.</p> : null}
                          {canManage ? <ProductManageForm businessId={business.id} product={product} /> : null}
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              </DataPanel>

              {canManage ? (
                <details className="portal-panel group">
                  <summary className="cursor-pointer list-none p-4 font-bold text-portal-ink sm:p-5">Tambah produk <span className="ml-2 text-xs font-semibold text-portal-forest">Buka</span></summary>
                  <div className="border-t border-portal-line p-4 sm:p-5"><ProductQuickForm businessId={business.id} /></div>
                </details>
              ) : null}

              {(canViewCosting || canViewChannels) ? (
                <details className="portal-panel group">
                  <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-bold text-portal-ink">Pengaturan lanjutan produk</span><span className="ml-2 text-xs font-semibold text-portal-soft">Modal & tempat jualan</span></summary>
                  <div className="grid gap-3 border-t border-portal-line p-4 sm:grid-cols-2 sm:p-5">
                    {canViewCosting ? <Link href={`/businesses/${business.id}/products/hpp`} className="rounded-xl border border-portal-line p-4 transition hover:bg-portal-mist/40"><Calculator className="h-4 w-4 text-portal-forest" /><p className="mt-3 font-bold text-portal-ink">Modal produk (HPP)</p><p className="mt-1 text-sm leading-6 text-portal-soft">Isi bahan dan jumlah pemakaian agar modal per produk dihitung dari data usaha.</p></Link> : null}
                    {canViewChannels ? <Link href={`/businesses/${business.id}/channels`} className="rounded-xl border border-portal-line p-4 transition hover:bg-portal-mist/40"><Store className="h-4 w-4 text-portal-forest" /><p className="mt-3 font-bold text-portal-ink">Harga jual online</p><p className="mt-1 text-sm leading-6 text-portal-soft">Bandingkan harga setelah potongan aplikasi dan promo yang ditanggung toko.</p></Link> : null}
                  </div>
                </details>
              ) : null}
            </>
          ) : primaryMode === 'view-only' ? (
            <EmptyState title="Belum ada produk" description="Belum ada produk yang dapat dilihat. Menambah atau mengubah produk membutuhkan akses yang sesuai." icon={Boxes} />
          ) : null}
        </div>
      </SectionCard>
    </PortalShell>
  );
}
