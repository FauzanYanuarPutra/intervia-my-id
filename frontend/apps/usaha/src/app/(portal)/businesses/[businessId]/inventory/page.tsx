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
import {
  resolveInventoryTab,
  sortStockAttentionFirst,
  type InventoryTab,
} from '@/lib/business-control/progressive-disclosure';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
};

const tabLabels: Array<{ id: InventoryTab; label: string }> = [
  { id: 'stock', label: 'Stok produk' },
  { id: 'purchase', label: 'Belanja & hasil' },
  { id: 'ingredients', label: 'Bahan & kemasan' },
];

export default async function BusinessInventoryPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const tab = resolveInventoryTab((await searchParams)?.tab);
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewInventory');
  const canViewIngredientCosts = hasPermission(business, 'viewCosting');
  const canManageIngredients =
    hasPermission(business, 'manageInventory') ||
    hasPermission(business, 'manageCosting');

  const needsIngredients =
    canViewIngredientCosts && (tab === 'purchase' || tab === 'ingredients');
  const ingredients = needsIngredients
    ? await listControlIngredients(business.id)
    : [];
  const observations =
    canViewIngredientCosts && tab === 'purchase'
      ? await listWave2YieldObservations(business.id)
      : [];

  const sortedProducts = sortStockAttentionFirst(business.products);
  const attention = sortedProducts.filter(
    item => item.stockHealth && item.stockHealth !== 'aman',
  );
  const primaryLocation =
    business.locations?.find(location => location.isPrimary) ??
    business.locations?.[0] ??
    null;

  const sectionCopy =
    tab === 'purchase'
      ? {
          eyebrow: 'Belanja',
          title: 'Catat belanja dan hasil yang benar-benar diterima',
          description:
            'Pembelian bahan, penambahan stok, dan hasil bersih dicatat dalam satu alur supaya angka operasional tetap nyata.',
        }
      : tab === 'ingredients'
        ? {
            eyebrow: 'Bahan',
            title: 'Atur bahan dan kemasan tanpa form yang membingungkan',
            description:
              'Mulai dari nama, harga dan satuan, lalu stok. Konversi umum dihitung otomatis dan pengaturan lanjutan tetap tersedia saat dibutuhkan.',
          }
        : {
            eyebrow: 'Stok',
            title: 'Cek yang hampir habis dulu',
            description:
              'Barang yang habis, tipis, atau belum cocok jumlahnya tampil paling atas. Fokus halaman ini hanya kondisi stok produk.',
          };

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="inventory"
    >
      <SectionCard
        eyebrow={sectionCopy.eyebrow}
        title={sectionCopy.title}
        description={sectionCopy.description}
      >
        {canView ? (
          <div className="space-y-4">
            <nav
              aria-label="Bagian inventori"
              className="flex gap-2 overflow-x-auto rounded-xl border border-portal-line bg-white p-1.5"
            >
              {tabLabels.map(item => {
                const restricted = item.id !== 'stock' && !canViewIngredientCosts;
                if (restricted) return null;
                const active = tab === item.id;
                return (
                  <Link
                    key={item.id}
                    href={`/businesses/${business.id}/inventory?tab=${item.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`min-h-10 shrink-0 rounded-lg px-3 py-2 text-sm font-bold transition ${
                      active
                        ? 'bg-portal-forest text-white'
                        : 'text-portal-soft hover:bg-portal-mist hover:text-portal-forest'
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {tab === 'stock' ? (
              <>
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
                              Jumlah: {product.stockLabel} · {product.stockUnit ?? 'pcs'}
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
              </>
            ) : null}

            {tab === 'purchase' && canViewIngredientCosts ? (
              <StockPurchaseYieldWorkspace
                businessId={business.id}
                ingredients={ingredients.map(item => ({
                  id: item.id,
                  name: item.name,
                  purchase_unit: item.purchase_unit,
                }))}
                products={business.products.map(product => ({
                  id: product.id,
                  name: product.name,
                }))}
                observations={observations}
                canManage={canManageIngredients}
              />
            ) : null}

            {tab === 'ingredients' && canViewIngredientCosts ? (
              <>
                <IngredientWorkspace
                  businessId={business.id}
                  initialIngredients={ingredients}
                  primaryLocationId={primaryLocation?.id ?? null}
                  primaryLocationName={primaryLocation?.name ?? null}
                  canManage={canManageIngredients}
                />
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
              </>
            ) : null}

            {tab !== 'stock' && !canViewIngredientCosts ? (
              <div className="portal-panel p-5 text-sm text-portal-soft">
                Peranmu tidak memiliki akses melihat biaya bahan dan HPP usaha.
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
