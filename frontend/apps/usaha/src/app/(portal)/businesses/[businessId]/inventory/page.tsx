import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Boxes, PackagePlus, TriangleAlert } from 'lucide-react';
import { IngredientWorkspace } from '@/components/business-control/IngredientWorkspace';
import { StockPurchaseYieldWorkspace } from '@/components/business-control/StockPurchaseYieldWorkspace';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { listWave2YieldObservations } from '@/lib/business-wave2-server';
import { listControlIngredients } from '@/lib/business-control-server';
import { sortStockAttentionFirst } from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessInventoryPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewInventory');
  const canViewIngredientCosts = hasPermission(business, 'viewCosting');
  const canManageIngredients =
    hasPermission(business, 'manageInventory') ||
    hasPermission(business, 'manageCosting');
  const [ingredients, observations] = canViewIngredientCosts
    ? await Promise.all([
        listControlIngredients(business.id),
        listWave2YieldObservations(business.id),
      ])
    : [[], []];
  const sortedProducts = sortStockAttentionFirst(business.products);
  const attention = sortedProducts.filter(
    item => item.stockHealth && item.stockHealth !== 'aman',
  );
  const primaryLocation =
    business.locations?.find(location => location.isPrimary) ??
    business.locations?.[0] ??
    null;

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="inventory"
    >
      <SectionCard
        eyebrow="Stok"
        title="Cek yang hampir habis dulu"
        description="Barang yang habis, tipis, atau belum cocok jumlahnya tampil paling atas. Belanja dapat menambah stok dan mencatat uang keluar dalam satu kejadian."
      >
        {canView ? (
          <div className="space-y-4">
            <section className="grid gap-2 sm:grid-cols-3">
              <div className="portal-panel p-4">
                <TriangleAlert className="h-4 w-4 text-portal-forest" />
                <p className="mt-2 text-2xl font-bold text-portal-ink">
                  {attention.length}
                </p>
                <p className="mt-1 text-xs text-portal-soft">Perlu dicek</p>
              </div>
              <div className="portal-panel p-4">
                <Boxes className="h-4 w-4 text-portal-forest" />
                <p className="mt-2 text-2xl font-bold text-portal-ink">
                  {business.products.length}
                </p>
                <p className="mt-1 text-xs text-portal-soft">Produk tercatat</p>
              </div>
              <div className="portal-panel p-4">
                <PackagePlus className="h-4 w-4 text-portal-forest" />
                <p className="mt-2 font-bold text-portal-ink">
                  {attention.length
                    ? 'Isi stok yang perlu'
                    : 'Stok produk tidak menunjukkan peringatan'}
                </p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">
                  Gunakan jumlah yang benar-benar kamu lihat di lapangan.
                </p>
              </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-portal-line bg-white">
              <div className="border-b border-portal-line px-4 py-3 sm:px-5">
                <h2 className="font-bold text-portal-ink">Produk</h2>
                <p className="mt-1 text-xs text-portal-soft">
                  Habis dan tipis selalu ditaruh lebih dulu.
                </p>
              </div>
              <div className="divide-y divide-portal-line">
                {sortedProducts.length ? (
                  sortedProducts.map(product => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-bold text-portal-ink">
                          {product.name}
                        </p>
                        <p className="mt-1 text-xs text-portal-soft">
                          Jumlah: {product.stockLabel} ·{' '}
                          {product.stockUnit ?? 'pcs'}
                        </p>
                      </div>
                      <StatusBadge
                        tone={
                          product.stockHealth === 'habis'
                            ? 'danger'
                            : product.stockHealth === 'aman'
                              ? 'success'
                              : 'warning'
                        }
                      >
                        {product.stockHealth === 'habis'
                          ? 'Habis'
                          : product.stockHealth === 'tipis'
                            ? 'Tipis'
                            : product.stockHealth === 'perlu-cocokkan'
                              ? 'Perlu dicek'
                              : 'Aman'}
                      </StatusBadge>
                    </div>
                  ))
                ) : (
                  <div className="p-5 text-sm text-portal-soft">
                    Belum ada produk. Tambahkan produk terlebih dahulu.
                  </div>
                )}
              </div>
            </section>

            {canViewIngredientCosts ? (
              <StockPurchaseYieldWorkspace
                businessId={business.id}
                ingredients={ingredients.map(item => ({
                  id: item.id,
                  name: item.name,
                  purchase_unit: item.purchase_unit,
                }))}
                products={business.products.map(product => ({ id: product.id, name: product.name }))}
                observations={observations}
                canManage={canManageIngredients}
              />
            ) : null}

            {canViewIngredientCosts ? (
              <details className="portal-panel group">
                <summary className="cursor-pointer list-none p-4 sm:p-5">
                  <span className="font-bold text-portal-ink">
                    Detail Bahan & Kemasan
                  </span>
                  <span className="ml-2 text-xs font-semibold text-portal-soft">
                    Harga beli, stok minimum, supplier, dan penyesuaian lanjutan
                  </span>
                </summary>
                <div className="border-t border-portal-line p-3 sm:p-4">
                  <IngredientWorkspace
                    businessId={business.id}
                    initialIngredients={ingredients}
                    primaryLocationId={primaryLocation?.id ?? null}
                    primaryLocationName={primaryLocation?.name ?? null}
                    canManage={canManageIngredients}
                  />
                </div>
              </details>
            ) : null}

            {canViewIngredientCosts ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-portal-line bg-white p-4 sm:p-5">
                <div>
                  <p className="font-bold text-portal-ink">
                    Ingin menghitung modal produk lebih rinci?
                  </p>
                  <p className="mt-1 text-sm text-portal-soft">
                    HPP tetap opsional untuk mulai jualan. Isi bahan saat datanya sudah tersedia.
                  </p>
                </div>
                <Link
                  href={`/businesses/${business.id}/products/hpp`}
                  className="portal-button-secondary"
                >
                  Modal produk (HPP)
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">
            Peranmu tidak memiliki akses melihat stok usaha.
          </div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
