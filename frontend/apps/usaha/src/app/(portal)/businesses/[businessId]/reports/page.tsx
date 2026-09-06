import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3, Calculator, PackageSearch, Store, WalletCards } from 'lucide-react';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import {
  listControlChannels,
  listControlFinanceEntries,
  listControlIngredients,
} from '@/lib/business-control-server';
import { jakartaDateKey, summarizeControlCenter } from '@/lib/business-control/insights';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export default async function BusinessReportsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewReports');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewFinance = hasPermission(business, 'viewFinance');
  const canViewChannels = hasPermission(business, 'viewChannels');

  const [ingredients, financeEntries, channels] = canView
    ? await Promise.all([
        canViewCosting ? listControlIngredients(business.id) : Promise.resolve([]),
        canViewFinance ? listControlFinanceEntries(business.id) : Promise.resolve([]),
        canViewChannels ? listControlChannels(business.id) : Promise.resolve([]),
      ])
    : [[], [], []];
  const summary = summarizeControlCenter({
    ingredients,
    financeEntries,
    channels,
    today: jakartaDateKey(),
  });

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="reports">
      <SectionCard eyebrow="Laporan" title="Lihat yang penting, bukan tumpukan angka" description="Ringkasan ini hanya memakai data yang sudah dicatat di usaha. Kalau datanya belum ada, Lajukan akan mengatakan belum ada—bukan mengarang omzet, laba, atau stok.">
        {canView ? (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><BarChart3 className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">Omzet hari ini</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{canViewFinance && summary.todayEntryCount ? money.format(summary.financeToday.revenue) : 'Belum ada data'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">{canViewFinance ? `${summary.todayEntryCount} catatan uang hari ini. HPP produk belum dikurangkan dari angka ini.` : 'Data keuangan dibatasi sesuai peran.'}</p>
              </div>
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><WalletCards className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">Gerak kas tercatat hari ini</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{canViewFinance && summary.todayEntryCount ? money.format(summary.financeToday.cashMovement) : 'Belum ada data'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">Modal pemilik dan ambil pribadi memengaruhi kas, tetapi tidak dihitung sebagai omzet usaha.</p>
              </div>
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><PackageSearch className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">Bahan perlu perhatian</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{canViewCosting ? summary.lowIngredientCount : '—'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">{canViewCosting ? ingredients.length ? `${ingredients.length} bahan/kemasan tercatat.` : 'Belum ada bahan untuk dihitung.' : 'Detail biaya bahan dibatasi sesuai peran.'}</p>
              </div>
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><Store className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">Kanal aktif</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{canViewChannels ? summary.enabledChannelCount : '—'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">{canViewChannels ? `${summary.configuredChannelCount} kanal punya asumsi tersimpan.` : 'Pengaturan kanal dibatasi sesuai peran.'}</p>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="portal-panel p-5">
                <p className="portal-kicker">HPP & stok</p>
                <h2 className="mt-1 font-bold text-portal-ink">{canViewCosting && summary.lowIngredientCount ? `${summary.lowIngredientCount} bahan mencapai batas minimum` : canViewCosting && ingredients.length ? 'Bahan belum menunjukkan batas minimum kritis' : 'Lengkapi bahan untuk mulai costing'}</h2>
                <p className="mt-2 text-sm leading-6 text-portal-soft">{canViewCosting && summary.lowIngredients.length ? `Prioritas: ${summary.lowIngredients.slice(0, 4).map(item => item.name).join(', ')}.` : 'Harga beli, yield, susut, dan stok bahan menjadi dasar HPP serta kapasitas produksi.'}</p>
                <div className="mt-4 flex flex-wrap gap-2"><Link href={`/businesses/${business.id}/inventory`} className="portal-button-primary">Buka stok</Link>{canViewCosting ? <Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-secondary"><Calculator className="h-4 w-4" /> Buka HPP</Link> : null}</div>
              </div>
              <div className="portal-panel p-5">
                <p className="portal-kicker">Uang hari ini</p>
                <h2 className="mt-1 font-bold text-portal-ink">{canViewFinance && summary.todayEntryCount ? `${summary.todayEntryCount} transaksi sudah tercatat` : 'Belum ada transaksi hari ini'}</h2>
                <p className="mt-2 text-sm leading-6 text-portal-soft">{canViewFinance && summary.todayEntryCount ? `Pendapatan penjualan tercatat ${money.format(summary.financeToday.revenue)} dan biaya operasional tercatat ${money.format(summary.financeToday.operatingExpenses)}.` : 'Catat uang masuk dan keluar agar laporan harian berasal dari kejadian nyata, bukan perkiraan.'}</p>
                {canViewFinance ? <Link href={`/businesses/${business.id}/finance`} className="portal-button-primary mt-4">Buka Uang</Link> : null}
              </div>
              <div className="portal-panel p-5">
                <p className="portal-kicker">Kanal jual</p>
                <h2 className="mt-1 font-bold text-portal-ink">{canViewChannels && summary.configuredChannelCount ? `${summary.enabledChannelCount} dari ${summary.configuredChannelCount} kanal aktif` : 'Belum ada asumsi kanal tersimpan'}</h2>
                <p className="mt-2 text-sm leading-6 text-portal-soft">Fee dan promo tidak di-hard-code. Gunakan angka sesuai kontrak merchant lalu bandingkan margin sebelum mengubah harga.</p>
                {canViewChannels ? <Link href={`/businesses/${business.id}/channels`} className="portal-button-primary mt-4">Buka Kanal Jual</Link> : null}
              </div>
            </section>
          </div>
        ) : <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat laporan biaya dan keuangan.</div>}
      </SectionCard>
    </PortalShell>
  );
}
