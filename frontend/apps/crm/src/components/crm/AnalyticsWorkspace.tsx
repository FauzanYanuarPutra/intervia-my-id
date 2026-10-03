import { EmptyState, PageHeader } from 'lajukan-ui';
import type { CrmListingRow, CrmTransactionRow, CrmUserRow, DashboardData } from './models';
import { buildAnalyticsSummary } from './analyticsModel';
import CrmAnalyticsDashboard from './CrmAnalyticsDashboard';
import type { CrmLead, CrmActivity, CrmBusiness, SuperAppOrder, SuperAppTrustProfile, SupportTicket } from '@/lib/api';

const money=(c:number)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Math.max(0,c)/100);

function toDashboardData({
  users,
  listings,
  transactions,
  openSupport,
}: {
  users: CrmUserRow[];
  listings: CrmListingRow[];
  transactions: CrmTransactionRow[];
  openSupport: number;
}): DashboardData {
  const orders: SuperAppOrder[] = transactions.map(item => ({
    id: item.id,
    requester_id: item.buyer,
    partner_id: item.seller || null,
    merchant_id: null,
    provider_id: item.seller || null,
    service_type: item.serviceType,
    status: item.status,
    payment_mode: 'crm',
    currency: 'IDR',
    amount_estimate_cents: item.amountCents,
    amount_final_cents: item.amountCents,
    pickup_address: null,
    pickup_lat: null,
    pickup_lng: null,
    dropoff_address: null,
    dropoff_lat: null,
    dropoff_lng: null,
    risk_score: item.riskScore,
    risk_flags: null,
    metadata: {},
    created_at: item.updatedAt,
    updated_at: item.updatedAt,
  }));

  const businesses: CrmBusiness[] = [];
  const tickets: SupportTicket[] = Array.from({ length: Math.max(0, openSupport) }, (_, index) => ({
    id: 'analytics-open-' + index,
    requester_user_id: null,
    requester_email: '',
    requester_name: null,
    category: 'support',
    subject: 'Support terbuka',
    status: 'open',
    priority: 'normal',
    assigned_agent_id: null,
    support_room_id: null,
    source: 'analytics',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    resolved_at: null,
    first_response_at: null,
    latest_message: null,
    latest_message_at: null,
  }));

  const leads: CrmLead[] = [];
  const activities: CrmActivity[] = [];
  const trustProfiles: SuperAppTrustProfile[] = [];

  return {
    users,
    listings,
    businesses,
    orders,
    tickets,
    leads,
    activities,
    trustProfiles,
    chats: [],
    sampleCollections: [],
    emptyCollections: [],
    failures: [],
  };
}

export function AnalyticsWorkspace({
  users,
  listings,
  transactions,
  openSupport,
}: {
  users: CrmUserRow[];
  listings: CrmListingRow[];
  transactions: CrmTransactionRow[];
  openSupport: number;
}) {
  const s = buildAnalyticsSummary({
    users: users.length,
    listings: listings.length,
    transactions,
    openSupport,
  });
  const dashboardData = toDashboardData({
    users,
    listings,
    transactions,
    openSupport,
  });
  const sellers = [...users]
    .filter(u => u.role === 'Seller' || u.role === 'Talent')
    .sort((a, b) => b.gmvCents - a.gmvCents)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics CRM"
        description="Grafik interaktif dari data live yang sedang dimuat CRM. Gunakan filter chart untuk melihat beberapa sudut pandang tanpa pindah halaman."
      />
      <CrmAnalyticsDashboard data={dashboardData} />

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
