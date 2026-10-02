import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Calculator, PackageSearch, Sparkles, Store, WalletCards } from 'lucide-react';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { getBusinessAdvisorSummary } from '@/lib/business-advisor-server';
import {
  listControlChannels,
  listControlIngredients,
} from '@/lib/business-control-server';
import { getFinanceCoreSummary } from '@/lib/finance-core-server';
import { getSalesPeriodSummary } from '@/lib/sales-summary-server';
import { jakartaDateKey, summarizeControlCenter } from '@/lib/business-control/insights';
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

  let ingredients: Awaited<ReturnType<typeof listControlIngredients>> = [];
  let channels: Awaited<ReturnType<typeof listControlChannels>> = [];
  let financeSummary: Awaited<ReturnType<typeof getFinanceCoreSummary>> | null = null;
  let salesSummary: Awaited<ReturnType<typeof getSalesPeriodSummary>> | null = null;
  let criticalDataError = false;

  if (canView) {
    try {
      [financeSummary, salesSummary] = await Promise.all([
        canViewFinance
          ? getFinanceCoreSummary(business.id, { from: periodStart, to: today })
          : Promise.resolve(null),
        getSalesPeriodSummary(business.id, { from: periodStart, to: today }),
      ]);
    } catch {
      criticalDataError = true;
    }

    [ingredients, channels] = await Promise.all([
      canViewCosting ? listControlIngredients(business.id) : Promise.resolve([]),
      canViewChannels ? listControlChannels(business.id) : Promise.resolve([]),
    ]);
  }

  const advisor = canView && canViewFinance && !criticalDataError
    ? await getBusinessAdvisorSummary(business.id)
    : null;
  const summary = summarizeControlCenter({
    ingredients,
    financeEntries: [],
    channels,
    today,
  });
  const hasSales = Boolean(salesSummary && salesSummary.transaction_count > 0);
  const costComplete = Boolean(
    canViewCosting &&
      salesSummary &&
      salesSummary.transaction_count > 0 &&
      salesSummary.incomplete_cost_count === 0,
  );
  const grossProfit = costComplete && salesSummary
    ? salesSummary.revenue - salesSummary.cogs
    : null;
  const recordedOperatingResult = grossProfit !== null && financeSummary
    ? grossProfit - financeSummary.operating_expenses
    : null;
  const revenueMismatch = Boolean(
    salesSummary &&
      financeSummary &&
      Math.abs(salesSummary.revenue - financeSummary.sale_revenue) > 0,
  );

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
          {criticalDataError ? (
            <section className="rounded-[18px] border border-rose-200 bg-rose-50 p-4">
              <p className="font-black text-rose-950">Laporan belum bisa dibaca dengan aman</p>
              <p className="mt-1 text-xs leading-5 text-rose-800">
                Data uang atau penjualan sedang tidak tersedia. Angka tidak ditampilkan sebagai Rp0 agar tidak menyesatkan.
              </p>
            </section>
          ) : (
            <>
              <MetricStrip items={[
                { label: 'Penjualan', value: hasSales && salesSummary ? money.format(salesSummary.revenue) : '—', note: hasSales && salesSummary ? `${salesSummary.transaction_count} transaksi selesai` : 'Belum ada penjualan pada periode ini' },
                { label: 'Laba kotor', value: canViewCosting ? (grossProfit === null ? 'Belum lengkap' : money.format(grossProfit)) : '—', note: canViewCosting ? (salesSummary?.incomplete_cost_count ? 'Ada HPP yang belum lengkap' : 'HPP lengkap') : 'Sesuai akses' },
                { label: 'Uang keluar', value: canViewFinance && financeSummary ? money.format(financeSummary.operating_expenses) : '—', note: canViewFinance ? 'Biaya operasi tercatat pada periode ini' : 'Sesuai akses' },
                { label: 'Hasil tercatat', value: recordedOperatingResult === null ? 'Belum lengkap' : money.format(recordedOperatingResult), note: 'Laba kotor dikurangi biaya operasi tercatat' },
              ]} />
              {revenueMismatch ? (
                <section className="mt-3 rounded-[16px] border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                  Omzet penjualan dan ledger uang tidak sama pada periode ini. Laporan tetap menampilkan keduanya, tetapi selisihnya perlu diperiksa.
                </section>
              ) : null}
            </>
          )}

          {(!criticalDataError && salesSummary && salesSummary.incomplete_cost_count > 0 && hasSales && canViewCosting) ? (
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
                <p className="mt-1 text-lg font-black text-portal-ink">{financeSummary ? money.format(financeSummary.cash_movement) : 'Belum tersedia'}</p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">Gerak kas yang benar-benar tercatat pada periode ini.</p>
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
