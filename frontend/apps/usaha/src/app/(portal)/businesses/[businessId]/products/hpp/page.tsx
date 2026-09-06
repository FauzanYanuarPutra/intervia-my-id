import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Info } from 'lucide-react';
import { HppCalculator } from '@/components/business-control/HppCalculator';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessHppPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewCosting');

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="products">
      <SectionCard eyebrow="Produk & HPP" title="Hitung modal per produk" description="Masukkan bahan dan kemasan yang benar-benar dipakai. Lajukan menghitung biaya per porsi, margin, dan bahan yang membatasi produksi.">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href={`/businesses/${business.id}/products`} className="portal-button-secondary"><ArrowLeft className="h-4 w-4" /> Kembali ke produk</Link>
            <div className="flex max-w-2xl gap-2 rounded-2xl border border-portal-line bg-white px-3 py-2 text-xs leading-5 text-portal-soft"><Info className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" /><p>Angka di halaman ini adalah alat bantu perhitungan. Penyimpanan bahan/resep ke backend canonical akan masuk tahap persistence berikutnya, jadi jangan menganggap data contoh sebagai catatan keuangan resmi.</p></div>
          </div>
          {canView ? <HppCalculator /> : <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat HPP, biaya supplier, dan margin produk.</div>}
        </div>
      </SectionCard>
    </PortalShell>
  );
}
