import { Card, EmptyState, StatusBadge } from 'lajukan-ui';
import type { DashboardData } from './models';

export function OperationsOverview({ data }: { data: DashboardData }) {
  const openSupport = data.tickets.filter(ticket =>
    ['open', 'in_progress', 'pending_customer'].includes(ticket.status),
  ).length;
  const pendingKyc = data.users.filter(user => user.kyc === 'Pending').length;
  const riskyOrders = data.orders.filter(
    order => order.status === 'disputed' || order.risk_score >= 70,
  ).length;
  const reported = data.listings.filter(listing => listing.reportCount > 0).length;

  const cards = [
    ['Support', openSupport],
    ['KYC', pendingKyc],
    ['Order berisiko', riskyOrders],
    ['Listing dilaporkan', reported],
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-black tracking-tight text-slate-950">Ringkasan hari ini</p>
          <p className="mt-0.5 text-xs text-slate-400">Angka dari data yang benar-benar tersedia.</p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value]) => (
          <Card key={String(label)} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-slate-500">{label}</p>
              {Number(value) > 0 ? (
                <StatusBadge tone="warning">Cek</StatusBadge>
              ) : null}
            </div>
            <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">{value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <p className="text-sm font-black text-slate-950">Aktivitas</p>
        </div>

        {data.activities.length ? (
          <div className="divide-y divide-slate-100">
            {data.activities.slice(0, 8).map(activity => (
              <div key={activity.id} className="px-4 py-3 sm:px-5">
                <p className="text-sm font-bold text-slate-900">{activity.title}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-400">
                  {activity.body}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="Belum ada aktivitas"
              description="Aktivitas real akan muncul ketika service mengirim data."
            />
          </div>
        )}
      </Card>
    </div>
  );
}
