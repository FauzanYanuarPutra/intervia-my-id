import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BarChart3, Calculator, PackageSearch, Sparkles, Store, WalletCards } from 'lucide-react';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { getBusinessAdvisorSummary } from '@/lib/business-advisor-server';
import {
  listControlChannels,
  listControlFinanceEntries,
  listControlIngredients,
  listControlSales,
} from '@/lib/business-control-server';
import { jakartaDateKey, summarizeControlCenter } from '@/lib/business-control/insights';
import { summarizeSales } from '@/lib/business-control/sales';
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
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewReports');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewFinance = hasPermission(business, 'viewFinance');
  const canViewChannels = hasPermission(business, 'viewChannels');
  const today = jakartaDateKey();

  const [ingredients, financeEntries, channels, sales] = canView
    ? await Promise.all([
        canViewCosting
          ? listControlIngredients(business.id)
          : Promise.resolve([]),
        canViewFinance
          ? listControlFinanceEntries(business.id)
          : Promise.resolve([]),
        canViewChannels ? listControlChannels(business.id) : Promise.resolve([]),
        listControlSales(business.id),
      ])
    : [[], [], [], []];
  const advisor = canView && canViewFinance
    ? await getBusinessAdvisorSummary(business.id)
    : null;
  const summary = summarizeControlCenter({
    ingredients,
    financeEntries,
    channels,
    today,
  });
  const todaySales = sales.filter(
    item =>
      item.sale.status === 'completed' && item.sale.occurred_on === today,
  );
  const salesSummary = summarizeSales(todaySales.map(item => item.sale));
  const hasSalesToday = todaySales.length > 0;
  const grossProfit =
    canViewCosting && hasSalesToday ? salesSummary.grossProfit : null;
  const recordedOperatingResult =
    grossProfit !== null && canViewFinance
      ? grossProfit - summary.financeToday.operatingExpenses
      : null;

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="reports"
    >
      <SectionCard
        eyebrow="Laporan"
        title="Lihat yang penting, bukan tumpukan angka"
        description="Omzet dan HPP berasal dari penjualan canonical yang sudah tersimpan. Jika snapshot biaya belum lengkap, Lajukan menandainya—bukan mengubah HPP kosong menjadi Rp0."
      >
        {canView ? (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><BarChart3 className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">Omzet hari ini</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{hasSalesToday ? money.format(salesSummary.revenue) : 'Belum ada data'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">{hasSalesToday ? `${todaySales.length} penjualan canonical selesai.` : 'Belum ada penjualan canonical hari ini.'}</p>
              </div>
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><Calculator className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">HPP terjual</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{canViewCosting ? hasSalesToday && salesSummary.cogs !== null ? money.format(salesSummary.cogs) : hasSalesToday ? 'Belum lengkap' : 'Belum ada data' : '—'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">{canViewCosting ? salesSummary.costComplete ? 'Menggunakan snapshot saat penjualan disimpan.' : 'Ada snapshot biaya yang belum lengkap.' : 'Detail HPP dibatasi sesuai peran.'}</p>
              </div>
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><WalletCards className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">Laba kotor</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{canViewCosting ? grossProfit === null ? hasSalesToday ? 'Belum lengkap' : 'Belum ada data' : money.format(grossProfit) : '—'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">{canViewCosting && salesSummary.grossMarginPercent !== null ? `Margin kotor ${salesSummary.grossMarginPercent.toLocaleString('id-ID', { maximumFractionDigits: 1 })}%.` : 'Margin tidak ditampilkan tanpa HPP lengkap.'}</p>
              </div>
              <div className="portal-panel p-4">
                <div className="portal-icon-tile"><Store className="h-4 w-4" /></div>
                <p className="mt-3 portal-label">Biaya operasional hari ini</p>
                <p className="mt-1 text-2xl font-bold text-portal-ink">{canViewFinance && summary.todayEntryCount ? money.format(summary.financeToday.operatingExpenses) : canViewFinance ? 'Belum ada data' : '—'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">Modal pemilik, Ambil owner, dan transfer aplikasi tidak diubah menjadi omzet/laba.</p>
              </div>
            </section>

            {advisor ? (
              <section className="portal-panel p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="portal-kicker"><Sparkles className="mr-1 inline h-3.5 w-3.5" /> Saran hari ini</p>
                    <h2 className="mt-1 font-bold text-portal-ink">Berdasarkan angka deterministic, bukan tebakan AI</h2>
                  </div>
                  <span className="rounded-full border border-portal-line px-3 py-1 text-xs font-semibold text-portal-soft">
                    {advisor.provider.provider === 'disabled' ? 'Deterministic' : `Advisor: ${advisor.provider.provider}`}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 lg:grid-cols-2">
                  {advisor.signals.map(signal => (
                    <p key={signal} className="rounded-xl border border-portal-line bg-white px-4 py-3 text-sm leading-6 text-portal-ink">{signal}</p>
                  ))}
                </div>
                <p className="mt-3 text-xs leading-5 text-portal-soft">Advisor hanya membaca ringkasan terstruktur. Ia tidak punya endpoint untuk memindahkan uang, mengubah stok, harga, void, atau refund.</p>
              </section>
            ) : null}

            {!salesSummary.costComplete && hasSalesToday && canViewCosting ? (
              <div className="portal-panel flex flex-wrap items-center justify-between gap-3 p-4">
                <div><p className="font-bold text-portal-ink">HPP belum lengkap</p><p className="mt-1 text-sm text-portal-soft">Lengkapi resep/bahan saat datanya tersedia. Penjualan lama tetap memakai snapshot yang tersimpan dan tidak dihitung ulang diam-diam.</p></div>
                <Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-primary">Buka HPP</Link>
              </div>
            ) : null}

            <section className="grid gap-4 lg:grid-cols-3">
              <div className="portal-panel p-5">
                <p className="portal-kicker">HPP & stok</p>
                <h2 className="mt-1 font-bold text-portal-ink">{canViewCosting && summary.lowIngredientCount ? `${summary.lowIngredientCount} bahan mencapai batas minimum` : canViewCosting && ingredients.length ? 'Bahan belum menunjukkan batas minimum kritis' : 'Lengkapi bahan jika ingin menghitung HPP'}</h2>
                <p className="mt-2 text-sm leading-6 text-portal-soft">{canViewCosting && summary.lowIngredients.length ? `Prioritas: ${summary.lowIngredients.slice(0, 4).map(item => item.name).join(', ')}.` : 'Penjualan dengan resep/HPP lengkap mengurangi bahan sesuai snapshot resep. Jika HPP belum lengkap, konsumsi bahan tidak ditebak.'}</p>
                <div className="mt-4 flex flex-wrap gap-2"><Link href={`/businesses/${business.id}/inventory`} className="portal-button-primary">Buka stok</Link>{canViewCosting ? <Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-secondary"><Calculator className="h-4 w-4" /> Buka HPP</Link> : null}</div>
              </div>
              <div className="portal-panel p-5">
                <p className="portal-kicker">Hasil usaha tercatat</p>
                <h2 className="mt-1 font-bold text-portal-ink">{recordedOperatingResult === null ? 'Belum dapat dihitung lengkap' : money.format(recordedOperatingResult)}</h2>
                <p className="mt-2 text-sm leading-6 text-portal-soft">Ini laba kotor canonical dikurangi biaya operasional yang benar-benar tercatat hari ini. Bukan laba bersih final dan tidak memasukkan modal/drawing sebagai pendapatan atau biaya.</p>
                {canViewFinance ? <Link href={`/businesses/${business.id}/finance`} className="portal-button-primary mt-4">Buka Uang</Link> : null}
              </div>
              <div className="portal-panel p-5">
                <p className="portal-kicker">Kanal jual</p>
                <h2 className="mt-1 font-bold text-portal-ink">{canViewChannels && summary.configuredChannelCount ? `${summary.enabledChannelCount} dari ${summary.configuredChannelCount} kanal aktif` : 'Belum ada asumsi kanal tersimpan'}</h2>
                <p className="mt-2 text-sm leading-6 text-portal-soft">Potongan aplikasi dan promo tidak di-hard-code. Gunakan angka sesuai kontrak toko lalu bandingkan margin sebelum mengubah harga.</p>
                {canViewChannels ? <Link href={`/businesses/${business.id}/channels`} className="portal-button-primary mt-4">Buka Jual Online</Link> : null}
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><PackageSearch className="h-4 w-4" /></div><p className="mt-3 portal-label">Bahan perlu perhatian</p><p className="mt-1 text-2xl font-bold text-portal-ink">{canViewCosting ? summary.lowIngredientCount : '—'}</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><WalletCards className="h-4 w-4" /></div><p className="mt-3 portal-label">Gerak kas tercatat hari ini</p><p className="mt-1 text-2xl font-bold text-portal-ink">{canViewFinance && summary.todayEntryCount ? money.format(summary.financeToday.cashMovement) : 'Belum ada data'}</p></div>
            </section>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat laporan biaya dan keuangan.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
