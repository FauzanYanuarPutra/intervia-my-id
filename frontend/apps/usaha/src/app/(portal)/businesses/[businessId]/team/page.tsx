import { notFound } from 'next/navigation';
import { AlertTriangle, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { InviteMemberQuickForm } from '@/components/forms/InviteMemberQuickForm';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatCard } from '@/components/portal/StatCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import {
  invitationStatusLabel,
  organizationRoleLabel,
  type OrganizationInvitation,
  type OrganizationMember,
} from '@/lib/business-collaboration';
import {
  listOrganizationInvitationsForBusiness,
  listOrganizationMembersForBusiness,
} from '@/lib/business-collaboration-server';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

function displayMemberName(member: OrganizationMember) {
  return member.fullName || (member.username ? `@${member.username}` : '') || member.email || 'Anggota Lajukan';
}

function displayDate(value: string) {
  if (!value) return 'Tanggal tidak tersedia';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Tanggal tidak tersedia'
    : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function BusinessTeamPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canViewTeam = hasPermission(business, 'viewTeam');
  const canInvite = hasPermission(business, 'inviteMembers');
  const canManageRoles = hasPermission(business, 'manageRoles');

  let members: OrganizationMember[] = [];
  let invitations: OrganizationInvitation[] = [];
  let collaborationError = '';

  if (canViewTeam) {
    try {
      [members, invitations] = await Promise.all([
        listOrganizationMembersForBusiness(business.id),
        listOrganizationInvitationsForBusiness(business.id),
      ]);
    } catch (error) {
      collaborationError = error instanceof Error
        ? error.message
        : 'Data akses tim belum bisa dimuat.';
    }
  }

  const activeMembers = members.filter(member => member.status === 'active').length;
  const pendingInvites = invitations.filter(invitation => invitation.status === 'pending').length;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="team">
      <SectionCard eyebrow="Tim & keamanan" title="Tim" description="Kelola siapa yang punya akses ke usaha ini, perannya, dan undangan yang masih menunggu jawaban.">
        {!canViewTeam ? (
          <DataPanel><EmptyState title="Akses tim dibatasi" description="Peran ini tidak memiliki izin untuk melihat data anggota dan undangan usaha." icon={ShieldCheck} /></DataPanel>
        ) : collaborationError ? (
          <DataPanel>
            <EmptyState
              title="Data akses tim belum tersinkron"
              description="Lajukan tidak menampilkan daftar kosong palsu. Coba muat ulang setelah layanan akses usaha kembali tersedia atau periksa hubungan organisasi usaha."
              icon={AlertTriangle}
            />
          </DataPanel>
        ) : (
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Anggota aktif" value={activeMembers} icon={UsersRound} note="Berdasarkan akses organisasi Lajukan" />
              <StatCard label="Undangan pending" value={pendingInvites} icon={UserPlus} note={pendingInvites ? 'Masih menunggu respons penerima' : 'Tidak ada undangan tertunda'} />
              <StatCard label="Aksesmu" value={canManageRoles ? 'Pemilik' : canInvite ? 'Manager' : 'Pantau'} icon={ShieldCheck} note={canManageRoles ? 'Dapat mengatur peran dan akses sensitif' : canInvite ? 'Dapat mengelola operasional dan undangan' : 'Tidak dapat mengubah peran'} />
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <DataPanel title="Anggota tim" description="Sumber canonical akses aktif untuk usaha ini.">
                {members.length ? (
                  <div className="divide-y divide-portal-line">
                    {members.map(member => (
                      <article key={member.userId} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-bold text-portal-ink">{displayMemberName(member)}</p>
                            <StatusBadge tone={member.status === 'active' ? 'success' : 'neutral'}>{member.status === 'active' ? 'Aktif' : 'Nonaktif'}</StatusBadge>
                          </div>
                          <p className="mt-1 text-xs text-portal-soft">
                            {member.username ? `@${member.username}` : member.email || 'Identitas akun tersedia di Lajukan'}
                          </p>
                        </div>
                        <div className="sm:text-right">
                          <p className="text-sm font-bold text-portal-ink">{organizationRoleLabel(member.role)}</p>
                          <p className="mt-1 text-xs text-portal-soft">Bergabung {displayDate(member.joinedAt)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Belum ada anggota tambahan" description="Akun pemilik tetap memiliki akses. Anggota lain akan muncul setelah menerima undangan." icon={UsersRound} />
                )}
              </DataPanel>

              <DataPanel title={canInvite ? 'Undang anggota' : 'Akses undangan'} description={canInvite ? 'Cari akun Lajukan dan berikan peran sesuai pekerjaan yang dibutuhkan.' : 'Peranmu tidak dapat mengirim undangan baru.'}>
                <div className="p-4 sm:p-5">
                  {canInvite ? <InviteMemberQuickForm businessId={business.id} /> : <p className="text-sm leading-6 text-portal-soft">Pemilik atau manager dengan izin undangan dapat menambahkan anggota baru.</p>}
                </div>
              </DataPanel>
            </div>

            <DataPanel title="Riwayat undangan" description="Status undangan berasal langsung dari layanan Identity, termasuk undangan yang diterima, ditolak, atau kedaluwarsa.">
              {invitations.length ? (
                <div className="divide-y divide-portal-line">
                  {invitations.map(invitation => (
                    <article key={invitation.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                      <div>
                        <p className="font-bold text-portal-ink">{invitation.inviteeUsername ? `@${invitation.inviteeUsername}` : 'Akun Lajukan'}</p>
                        <p className="mt-1 text-xs text-portal-soft">{organizationRoleLabel(invitation.role)} · dikirim {displayDate(invitation.createdAt)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={invitation.status === 'accepted' ? 'success' : invitation.status === 'pending' ? 'warning' : 'neutral'}>{invitationStatusLabel(invitation.status)}</StatusBadge>
                        <span className="text-xs text-portal-soft">{invitation.status === 'pending' ? `berlaku s.d. ${displayDate(invitation.expiresAt)}` : displayDate(invitation.respondedAt || invitation.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Belum ada riwayat undangan" description="Undangan yang dikirim dari usaha ini akan tercatat di sini." icon={UserPlus} />
              )}
            </DataPanel>
          </div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
