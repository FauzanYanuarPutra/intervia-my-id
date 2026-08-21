import { notFound } from 'next/navigation';
import { getRoleSummary, hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { InviteMemberQuickForm } from '@/components/forms/InviteMemberQuickForm';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessTeamPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;

  if (!business) {
    notFound();
  }

  const canViewTeam = hasPermission(business, 'viewTeam');
  const canInvite = hasPermission(business, 'inviteMembers');
  const canManageRoles = hasPermission(business, 'manageRoles');

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="team"
    >
      <SectionCard
        eyebrow="Tim usaha"
        title="Undang tim dan bagi tugas"
        description="Tim dan peran."
      >
        <div className="grid gap-5">
          {canViewTeam ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-portal-soft">
                    Anggota aktif
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-[-0.04em] text-portal-ink">
                    {business.teamMembers.length}
                  </p>
                </div>
                <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-portal-soft">
                    Undangan pending
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-[-0.04em] text-portal-ink">
                    {business.invites.filter(invite => invite.status === 'pending').length}
                  </p>
                </div>
                <div className="rounded-[24px] border border-portal-line/70 bg-white p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-portal-soft">
                    Aksesmu
                  </p>
                  <p className="mt-2 text-xl font-bold tracking-[-0.04em] text-portal-ink">
                    {canManageRoles ? 'Bisa atur akses' : 'Pantau tim'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
                <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                  <p className="portal-kicker">{canInvite ? 'Undang anggota' : 'Mode akses'}</p>
                  {canInvite ? (
                    <div className="mt-4">
                      <InviteMemberQuickForm businessId={business.id} />
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-portal-soft">
                      Peran ini bisa lihat tim, tapi belum bisa kirim undangan baru.
                    </p>
                  )}
                </article>

                <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                  <p className="portal-kicker">Anggota tim</p>
                  <div className="mt-4 grid gap-3">
                    {business.teamMembers.map(member => {
                      const role = getRoleSummary(member.role);
                      return (
                        <div
                          key={member.id}
                          className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-portal-ink">{member.name}</p>
                              <p className="text-sm text-portal-soft">{member.phone}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-portal-ink">
                                {role.label}
                              </p>
                              <p className="text-xs text-portal-soft">{member.area}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              </div>

              <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                <p className="portal-kicker">Undangan</p>
                <div className="mt-4 grid gap-3">
                  {business.invites.length > 0 ? (
                    business.invites.map(invite => {
                      const role = getRoleSummary(invite.role);
                      return (
                        <div
                          key={invite.id}
                          className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-portal-ink">{invite.name}</p>
                              <p className="mt-1 text-sm text-portal-soft">
                                {invite.phone} - {role.label}
                              </p>
                            </div>
                            <p className="text-xs uppercase tracking-[0.18em] text-portal-soft">
                              {invite.status} - {invite.sentAt}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-[20px] border border-dashed border-portal-line bg-portal-sand/35 px-4 py-4 text-sm text-portal-soft">
                      Belum ada undangan.
                    </div>
                  )}
                </div>
              </article>
            </>
          ) : (
            <div className="rounded-[28px] border border-dashed border-portal-line bg-portal-sand/40 p-6 text-sm leading-7 text-portal-soft">
              Peran ini tidak punya akses ke data tim.
            </div>
          )}
        </div>
      </SectionCard>
    </PortalShell>
  );
}
