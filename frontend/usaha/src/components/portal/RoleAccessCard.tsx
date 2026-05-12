import { Ban, BadgeCheck } from 'lucide-react';
import { getRoleSummary } from '@/lib/portal-logic';
import type { PortalRole } from '@/lib/portal-types';

type RoleAccessCardProps = {
  role: PortalRole;
};

export function RoleAccessCard({ role }: RoleAccessCardProps) {
  const summary = getRoleSummary(role);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
        <p className="portal-kicker">Peran kamu</p>
        <h3 className="mt-1 text-xl font-black tracking-[-0.05em] text-portal-ink">
          {summary.label}
        </h3>
        <p className="mt-2 text-sm leading-6 text-portal-soft">{summary.description}</p>
      </article>

      <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
        <div className="grid gap-4 xl:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-portal-ink">Bisa dilakukan</p>
            <div className="mt-3 space-y-2">
              {summary.can.map(item => (
                <div
                  key={item}
                  className="inline-flex w-full items-start gap-2 rounded-2xl border border-portal-line/70 bg-portal-sand/35 px-3 py-2 text-sm text-portal-ink"
                >
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-portal-ink">Belum tersedia</p>
            <div className="mt-3 space-y-2">
              {summary.cannot.length > 0 ? (
                summary.cannot.map(item => (
                  <div
                    key={item}
                    className="inline-flex w-full items-start gap-2 rounded-2xl border border-portal-line/70 bg-white px-3 py-2 text-sm text-portal-soft"
                  >
                    <Ban className="mt-0.5 h-4 w-4 shrink-0 text-portal-ember" />
                    <span>{item}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-portal-line/70 bg-white px-3 py-2 text-sm text-portal-soft">
                  Tidak ada pembatasan tambahan untuk peran ini.
                </div>
              )}
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}
