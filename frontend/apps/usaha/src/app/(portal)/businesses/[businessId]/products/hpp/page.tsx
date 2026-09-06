import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { DurableHppWorkspace } from '@/components/business-control/DurableHppWorkspace';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { listControlIngredients } from '@/lib/business-control-server';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessHppPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewCosting');
  const ingredients = canView ? await listControlIngredients(business.id) : [];

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="products">
      <SectionCard eyebrow="Produk & HPP" title="Hitung modal per produk" description="Bahan, kemasan, yield, susut, stok, dan resep tersimpan per usaha. Lajukan menghitung HPP dari sumber yang sama agar angka tidak perlu diketik ulang.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/businesses/${business.id}/products`} className="portal-button-secondary"><ArrowLeft className="h-4 w-4" /> Kembali ke produk</Link>
            <div className="flex max-w-2xl gap-2 rounded-2xl border border-portal-line bg-white px-3 py-2 text-xs leading-5 text-portal-soft"><Info className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" /><p>Harga beli dan stok berasal dari <strong>Stok & Belanja</strong>. Perubahan resep disimpan ke backend canonical. HPP penjualan historis tetap perlu cost snapshot saat transaksi jual terhubung penuh.</p></div>
          </div>
          {canView ? (
            <DurableHppWorkspace
              businessId={business.id}
              ingredients={ingredients}
              products={business.products.map(product => ({ id: product.id, name: product.name, priceLabel: product.priceLabel }))}
            />
          ) : <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat HPP, biaya supplier, dan margin produk.</div>}
        </div>
      </SectionCard>
    </PortalShell>
  );
}
