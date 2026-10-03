import { EmptyState, PageHeader } from 'lajukan-ui';
import type { DashboardData } from './models';
import { buildAnalyticsSummary } from './analyticsModel';
import CrmAnalyticsDashboard from './CrmAnalyticsDashboard';

const money=(c:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Math.max(0,c)/100);

export function AnalyticsWorkspace({ data }: { data: DashboardData }) {
  const transactions = data.orders.map(order => ({
    amountCents: order.amount_final_cents || order.amount_estimate_cents || 0,
  }));
  const s = buildAnalyticsSummary({
    users: data.users.length,
    listings: data.listings.length,
    transactions,
    openSupport: data.tickets.filter(ticket => ['open', 'in_progress', 'pending_customer'].includes(ticket.status)).length,
  });
  const sellers = [...data.users]
    .filter(u => u.role === 'Seller' || u.role === 'Talent')
    .sort((a, b) => b.gmvCents - a.gmvCents)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics CRM"
        description="Grafik interaktif dari data live yang sedang dimuat CRM. Filter chart bekerja langsung di snapshot yang sama dengan workspace lain."
      />
      <CrmAnalyticsDashboard data={data} />

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,0.6)]">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {[
              ['User', String(s.users)],
              ['Listing', String(s.listings)],
              ['Transaksi', String(s.transactions)],
              ['GMV', money(s.gmvCents)],
              ['Support terbuka', String(s.openSupport)],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-bold text-slate-400">{label}</p>
                <p className="mt-1.5 truncate text-lg font-black text-slate-950">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_34px_-28px_rgba(15,23,42,0.6)]">
          <h3 className="text-sm font-black text-slate-950">Kontributor GMV teratas</h3>
          <div className="mt-3 space-y-2">
            {sellers.map(u => (
              <div key={u.id} className="flex justify-between gap-3 rounded-xl border border-slate-200 p-2.5">
                <span className="min-w-0 truncate text-xs font-semibold text-slate-700">{u.name}</span>
                <span className="shrink-0 text-xs font-black text-slate-950">{money(u.gmvCents)}</span>
              </div>
            ))}
            {!sellers.length ? (
              <EmptyState
                title="Belum ada kontributor"
                description="Ranking hanya muncul dari GMV user yang benar-benar dimuat."
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
