import Link from 'next/link';
import { BellDot, ShieldCheck, Users } from 'lucide-react';
import { roleSummaryMap } from '@/lib/portal-access';
import type { BusinessRecord } from '@/lib/portal-types';

type TeamSnapshotProps = {
  business: BusinessRecord;
  canViewTeam: boolean;
  canManageTeam: boolean;
};

export function TeamSnapshot({
  business,
  canViewTeam,
  canManageTeam,
}: TeamSnapshotProps) {
  if (!canViewTeam) {
    return (
      <div className="rounded-[24px] border border-portal-line/70 bg-portal-sand/40 p-5">
        <p className="text-sm font-semibold text-portal-ink">
          Tim usaha disembunyikan untuk peran ini
        </p>
        <p className="mt-2 text-sm leading-6 text-portal-soft">
          Role saat ini tidak punya akses ke data anggota, undangan, atau pengaturan jabatan.
        </p>
      </div>
    );
  }

  const pendingInvites = business.invites.filter(invite => invite.status === 'pending');

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
      <div className="rounded-[24px] border border-portal-line/70 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="portal-kicker">Tim usaha</p>
            <h3 className="mt-1 text-lg font-bold tracking-[-0.04em] text-portal-ink">
              {business.teamMembers.length} anggota aktif
            </h3>
          </div>
          <div className="flex w-full flex-col gap-2 text-sm font-semibold sm:w-auto sm:flex-row">
            {canManageTeam ? (
              <Link href={`/businesses/${business.id}/team`} className="portal-button-primary min-h-11 px-4">
                Undang anggota
              </Link>
            ) : null}
            <Link href={`/businesses/${business.id}/team`} className="portal-button-secondary min-h-11 px-4">
              Lihat tim
            </Link>
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {business.teamMembers.map(member => {
            const role = roleSummaryMap[member.role];
            return (
              <article
                key={member.id}
                className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3"
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
                  <div>
                    <p className="portal-label">Nama anggota</p>
                    <p className="font-semibold text-portal-ink">{member.name}</p>
                    <p className="text-sm text-portal-soft">{member.phone}</p>
                  </div>
                  <div className="sm:text-right">
                    <p className="portal-label">Tugas</p>
                    <p className="text-sm font-semibold text-portal-ink">{role.label}</p>
                    <p className="text-xs text-portal-soft">{member.area}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs uppercase tracking-[0.18em] text-portal-soft">
                  {member.lastSeen}
                </p>
              </article>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4">
        <div className="rounded-[24px] border border-portal-line/70 bg-portal-sand/45 p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-portal-forest">
              <BellDot className="h-5 w-5" />
            </span>
            <div>
              <p className="portal-kicker">Undangan</p>
              <h3 className="mt-1 text-lg font-bold tracking-[-0.04em] text-portal-ink">
                {pendingInvites.length} menunggu konfirmasi
              </h3>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {pendingInvites.length > 0 ? (
              pendingInvites.map(invite => (
                <div
                  key={invite.id}
                  className="rounded-[18px] border border-portal-line/70 bg-white px-4 py-3"
                >
                  <p className="font-semibold text-portal-ink">{invite.name}</p>
                  <p className="text-sm text-portal-soft">
                    {invite.phone} - {roleSummaryMap[invite.role].label}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm leading-6 text-portal-soft">
                Tidak ada undangan yang tertahan. Tim bisa lanjut kerja tanpa antrean approval.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-[24px] border border-portal-line/70 bg-white p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-portal-sand text-portal-forest">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="portal-kicker">Jabatan dan akses</p>
              <p className="mt-1 text-sm leading-6 text-portal-soft">
                Pakai jabatan sederhana yang mudah dijelaskan ke tim: owner, manager,
                kasir, dan viewer.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.values(roleSummaryMap).map(role => (
              <span
                key={role.label}
                className="inline-flex items-center gap-2 rounded-full border border-portal-line bg-portal-sand/35 px-3 py-2 text-sm font-semibold text-portal-ink"
              >
                <Users className="h-4 w-4 text-portal-forest" />
                {role.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
