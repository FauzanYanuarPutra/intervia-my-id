import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calculator, PackageSearch, Sparkles, Store, WalletCards } from 'lucide-react';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { getBusinessAdvisorSummary } from '@/lib/business-advisor-server';
import {
  listControlChannels,
  listControlFinanceEntries,
  listControlIngredients,
  listControlSales,
} from '@/lib/business-control-server';
import { jakartaDateKey, summarizeControlCenter } from '@/lib/business-control/insights';
import { summarizeSales } from '@/lib/business-control/sales';
import { summarizeFinanceEntries } from '@/lib/business-control/ledger';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ range?: string }>;
};

const money = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', maximumFractionDigits: 0,
});

function periodDays(value: string | undefined) {
  if (value === '7' || value === '30') return Number(value);
  return 1;
}

function shiftJakartaDate(today: string, daysBack: number) {
  const base = new Date(`${today}T00:00:00+07:00`);
  base.setUTCDate(base.getUTCDate() - daysBack);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(base);
}

export default async function BusinessReportsPage({ params, searchParams }: PageProps) {
  const { businessId } = await params;
  const query = await searchParams;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewReports');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const canViewFinance = hasPermission(business, 'viewFinance');
  const canViewChannels = hasPermission(business, 'viewChannels');
  const today = jakartaDateKey();
  const days = periodDays(query.range);
  const periodStart = shiftJakartaDate(today, days - 1);

  const [ingredients, financeEntries, channels, sales] = canView
    ? await Promise.all([
        canViewCosting ? listControlIngredients(business.id) : Promise.resolve([]),
        canViewFinance ? listControlFinanceEntries(business.id) : Promise.resolve([]),
        canViewChannels ? listControlChannels(business.id) : Promise.resolve([]),
        listControlSales(business.id),
      ])
    : [[], [], [], []];
  const advisor = canView && canViewFinance ? await getBusinessAdvisorSummary(business.id) : null;
  const summary = summarizeControlCenter({ ingredients, financeEntries, channels, today });
  const periodSales = sales.filter(item => item.sale.status === 'completed' && item.sale.occurred_on >= periodStart && item.sale.occurred_on <= today);
  const periodFinanceEntries = financeEntries.filter(entry => entry.occurred_on >= periodStart && entry.occurred_on <= today);
  const salesSummary = summarizeSales(periodSales.map(item => item.sale));
  const financeSummary = summarizeFinanceEntries(periodFinanceEntries);
  const hasSales = periodSales.length > 0;
  const grossProfit = canViewCosting && hasSales ? salesSummary.grossProfit : null;
  const recordedOperatingResult = grossProfit !== null && canViewFinance
    ? grossProfit - financeSummary.operatingExpenses
    : null;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="reports">
      <PageHeader eyebrow="Laporan" title="Kinerja usaha" description="Lihat hasil berdasarkan periode. Angka yang belum lengkap ditandai, bukan ditebak." />

      <div className="flex flex-wrap items-center gap-2">
        {[['1', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari']].map(([value, label]) => (
          <Link
            key={value}
            href={value === '1' ? `/businesses/${business.id}/reports` : `/businesses/${business.id}/reports?range=${value}`}
            className={`merchant-chip ${days === Number(value) ? 'merchant-chip-active' : ''}`}
          >
            {label}
          </Link>
        ))}
        <span className="text-xs text-portal-soft">{periodStart} – {today}</span>
      </div>

      {canView ? (
        <div className="space-y-4">
          <MetricStrip items={[
            { label: 'Penjualan', value: hasSales ? money.format(salesSummary.revenue) : '—', note: hasSales ? `${periodSales.length} transaksi selesai` : 'Belum ada penjualan pada periode ini' },
            { label: 'Laba kotor', value: canViewCosting ? (grossProfit === null ? 'Belum lengkap' : money.format(grossProfit)) : '—', note: canViewCosting ? (salesSummary.costComplete ? 'HPP lengkap' : 'Ada HPP yang belum lengkap') : 'Sesuai akses' },
            { label: 'Uang keluar', value: canViewFinance && periodFinanceEntries.length ? money.format(financeSummary.operatingExpenses) : '—', note: canViewFinance ? 'Biaya operasi tercatat pada periode ini' : 'Sesuai akses' },
            { label: 'Hasil tercatat', value: recordedOperatingResult === null ? 'Belum lengkap' : money.format(recordedOperatingResult), note: 'Laba kotor dikurangi biaya operasi tercatat' },
          ]} />

          {!salesSummary.costComplete && hasSales && canViewCosting ? (
            <section className="flex flex-col gap-3 rounded-[18px] bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-black text-amber-950">HPP belum lengkap</p><p className="mt-1 text-xs leading-5 text-amber-800">Lengkapi bahan/resep jika ingin melihat laba kotor yang lengkap.</p></div>
              <Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-secondary shrink-0">Buka HPP</Link>
            </section>
          ) : null}

          <section className="grid gap-3 lg:grid-cols-3">
            <Link href={`/businesses/${business.id}/inventory`} className="merchant-surface-bordered p-4 transition hover:border-portal-forest/25">
              <PackageSearch className="h-4 w-4 text-portal-forest" />
              <p className="mt-3 text-xs font-semibold text-portal-soft">Stok & bahan</p>
              <p className="mt-1 text-lg font-black text-portal-ink">{canViewCosting ? `${summary.lowIngredientCount} perlu perhatian` : 'Lihat stok'}</p>
              <p className="mt-1 text-xs leading-5 text-portal-soft">Selesaikan bahan atau produk yang hampir habis.</p>
            </Link>
            {canViewFinance ? (
              <Link href={`/businesses/${business.id}/finance`} className="merchant-surface-bordered p-4 transition hover:border-portal-forest/25">
                <WalletCards className="h-4 w-4 text-portal-forest" />
                <p className="mt-3 text-xs font-semibold text-portal-soft">Uang</p>
                <p className="mt-1 text-lg font-black text-portal-ink">{summary.todayEntryCount ? money.format(summary.financeToday.cashMovement) : 'Belum ada gerak kas'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">Gerak kas yang benar-benar tercatat hari ini.</p>
              </Link>
            ) : null}
            {canViewChannels ? (
              <Link href={`/businesses/${business.id}/channels`} className="merchant-surface-bordered p-4 transition hover:border-portal-forest/25">
                <Store className="h-4 w-4 text-portal-forest" />
                <p className="mt-3 text-xs font-semibold text-portal-soft">Jual online</p>
                <p className="mt-1 text-lg font-black text-portal-ink">{summary.configuredChannelCount ? `${summary.enabledChannelCount} kanal aktif` : 'Belum diatur'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">Cek harga dan potongan kanal online.</p>
              </Link>
            ) : null}
          </section>

          {advisor ? (
            <details className="merchant-surface-bordered group">
              <summary className="cursor-pointer list-none p-4 sm:p-5"><Sparkles className="mr-2 inline h-4 w-4 text-portal-forest" /><span className="font-black text-portal-ink">Saran hari ini</span><span className="ml-2 text-xs text-portal-soft">Berdasarkan data tercatat</span></summary>
              <div className="grid gap-2 border-t border-portal-line/70 p-4 sm:p-5 lg:grid-cols-2">
                {advisor.signals.map(signal => <p key={signal} className="rounded-xl bg-[#f7f9f6] px-4 py-3 text-sm leading-6 text-portal-ink">{signal}</p>)}
              </div>
            </details>
          ) : null}

          {canViewCosting ? <Link href={`/businesses/${business.id}/products/hpp`} className="portal-button-ghost"><Calculator className="h-4 w-4" /> Detail modal produk</Link> : null}
        </div>
      ) : (
        <div className="merchant-surface-bordered p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses melihat laporan usaha.</div>
      )}
    </PortalShell>
  );
}
