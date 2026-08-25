import { notFound } from 'next/navigation';
import { ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { InviteMemberQuickForm } from '@/components/forms/InviteMemberQuickForm';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { getRoleSummary, hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessTeamPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canViewTeam = hasPermission(business, 'viewTeam');
  const canInvite = hasPermission(business, 'inviteMembers');
  const canManageRoles = hasPermission(business, 'manageRoles');
  const pendingInvites = business.invites.filter(invite => invite.status === 'pending').length;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="team">
      <SectionCard eyebrow="Tim & keamanan" title="Tim" description="Lihat siapa yang punya akses ke usaha, pembagian peran, dan undangan yang belum selesai.">
        {!canViewTeam ? (
          <DataPanel><EmptyState title="Akses tim dibatasi" description="Peran ini tidak memiliki izin untuk melihat data anggota dan undangan usaha." icon={ShieldCheck} /></DataPanel>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Anggota aktif" value={business.teamMembers.length} icon={UsersRound} note="Anggota yang tercatat di workspace" />
              <StatCard label="Undangan pending" value={pendingInvites} icon={UserPlus} note={pendingInvites ? 'Masih menunggu respons' : 'Tidak ada undangan tertunda'} />
              <StatCard label="Aksesmu" value={canManageRoles ? 'Kelola' : 'Pantau'} icon={ShieldCheck} note={canManageRoles ? 'Dapat mengatur peran dan akses' : 'Tidak dapat mengubah peran'} />
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <DataPanel title="Anggota tim" description="Daftar orang yang saat ini memiliki akses ke usaha.">
                {business.teamMembers.length ? (
                  <div className="divide-y divide-portal-line">
                    {business.teamMembers.map(member => {
                      const role = getRoleSummary(member.role);
                      return (
                        <article key={member.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-portal-ink">{member.name}</p><StatusBadge tone={member.status === 'active' ? 'success' : 'neutral'}>{member.status === 'active' ? 'Aktif' : 'Nonaktif'}</StatusBadge></div>
                            <p className="mt-1 text-xs text-portal-soft">{member.phone || 'Nomor belum tersedia'} · {member.area || 'Area belum ditentukan'}</p>
                          </div>
                          <div className="sm:text-right"><p className="text-sm font-bold text-portal-ink">{role.label}</p><p className="mt-1 text-xs text-portal-soft">{member.lastSeen || 'Aktivitas belum tercatat'}</p></div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState title="Belum ada anggota tambahan" description="Saat anggota ditambahkan ke workspace, daftar aksesnya akan muncul di sini." icon={UsersRound} />
                )}
              </DataPanel>

              <DataPanel title={canInvite ? 'Undang anggota' : 'Akses undangan'} description={canInvite ? 'Tambahkan anggota sesuai peran yang dibutuhkan.' : 'Peranmu tidak dapat mengirim undangan baru.'}>
                <div className="p-4 sm:p-5">
                  {canInvite ? <InviteMemberQuickForm businessId={business.id} /> : <p className="text-sm leading-6 text-portal-soft">Owner atau manager dengan izin undangan dapat menambahkan anggota baru.</p>}
                </div>
              </DataPanel>
            </div>

            <DataPanel title="Undangan" description="Pantau undangan anggota yang pernah dikirim.">
              {business.invites.length ? (
                <div className="divide-y divide-portal-line">
                  {business.invites.map(invite => {
                    const role = getRoleSummary(invite.role);
                    return (
                      <article key={invite.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div><p className="font-bold text-portal-ink">{invite.name}</p><p className="mt-1 text-xs text-portal-soft">{invite.phone} · {role.label}</p></div>
                        <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={invite.status === 'accepted' ? 'success' : invite.status === 'pending' ? 'warning' : 'neutral'}>{invite.status}</StatusBadge><span className="text-xs text-portal-soft">{invite.sentAt}</span></div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <EmptyState title="Belum ada undangan" description="Riwayat undangan anggota akan muncul di bagian ini." icon={UserPlus} />
              )}
            </DataPanel>
          </div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
