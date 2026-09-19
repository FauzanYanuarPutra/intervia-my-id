import { notFound } from 'next/navigation';
import { AlertTriangle, ShieldCheck, UserPlus, UsersRound } from 'lucide-react';
import { InviteMemberQuickForm } from '@/components/forms/InviteMemberQuickForm';
import { EmptyState } from '@/components/portal/EmptyState';
import { MetricStrip } from '@/components/portal/MetricStrip';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
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
  return Number.isNaN(date.getTime()) ? 'Tanggal tidak tersedia' : date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default async function BusinessTeamPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  if (!hasPermission(business, 'viewTeam')) notFound();
  const canInvite = hasPermission(business, 'inviteMembers');
  const canManageRoles = hasPermission(business, 'manageRoles');

  let members: OrganizationMember[] = [];
  let invitations: OrganizationInvitation[] = [];
  let collaborationError = '';

  try {
    [members, invitations] = await Promise.all([
      listOrganizationMembersForBusiness(business.id),
      listOrganizationInvitationsForBusiness(business.id),
    ]);
  } catch (error) {
    collaborationError = error instanceof Error ? error.message : 'Data akses tim belum bisa dimuat.';
  }

  const activeMembers = members.filter(member => member.status === 'active').length;
  const pendingInvites = invitations.filter(invitation => invitation.status === 'pending').length;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="team">
      <PageHeader eyebrow="Kelola usaha" title="Tim & akses" description="Lihat siapa yang bisa masuk ke usaha ini, lalu undang orang baru hanya saat diperlukan." />

      <section className="merchant-surface-bordered flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <p className="text-sm font-black text-portal-ink">Pekerjaan tim</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">Lihat pekerjaan yang perlu dikerjakan, tugaskan ke anggota, dan pantau penyelesaiannya.</p>
        </div>
        <a href={`/businesses/${business.id}/work`} className="portal-button-secondary shrink-0">Buka pekerjaan</a>
      </section>

      {collaborationError ? (
        <div className="merchant-surface-bordered"><EmptyState title="Data tim belum bisa dimuat" description="Coba muat ulang setelah layanan akses kembali tersedia." icon={AlertTriangle} /></div>
      ) : (
        <div className="space-y-4">
          <MetricStrip items={[
            { label: 'Anggota aktif', value: activeMembers },
            { label: 'Undangan menunggu', value: pendingInvites },
            { label: 'Aksesmu', value: canManageRoles ? 'Pemilik' : canInvite ? 'Manager' : 'Pantau', note: canManageRoles ? 'Bisa mengatur peran' : canInvite ? 'Bisa mengundang anggota' : 'Lihat saja' },
          ]} />

          <section>
            <div className="mb-2.5 flex items-center justify-between gap-3"><div><h2 className="font-black text-portal-ink">Anggota tim</h2><p className="text-xs text-portal-soft">Orang yang punya akses ke usaha.</p></div>{canInvite ? <a href="#undang" className="portal-button-primary"><UserPlus className="h-4 w-4" /> Undang</a> : null}</div>
            <div className="merchant-list border border-portal-line/80">
              {members.length ? members.map(member => (
                <article key={member.userId} className="merchant-action-row">
                  <span className="portal-icon-tile"><UsersRound className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate text-sm font-black text-portal-ink">{displayMemberName(member)}</p><StatusBadge tone={member.status === 'active' ? 'success' : 'neutral'}>{member.status === 'active' ? 'Aktif' : 'Nonaktif'}</StatusBadge></div><p className="mt-0.5 text-[11px] text-portal-soft">{organizationRoleLabel(member.role)} · bergabung {displayDate(member.joinedAt)}</p></div>
                </article>
              )) : <EmptyState title="Belum ada anggota tambahan" description="Anggota lain muncul setelah menerima undangan." icon={UsersRound} />}
            </div>
          </section>

          {canInvite ? (
            <details id="undang" className="merchant-surface-bordered group">
              <summary className="merchant-action-row cursor-pointer list-none"><span className="portal-icon-tile"><UserPlus className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-portal-ink">Undang anggota</span><span className="block text-xs text-portal-soft">Cari akun Lajukan dan pilih perannya.</span></span><span className="text-xs font-black text-portal-forest">Buka</span></summary>
              <div className="border-t border-portal-line/70 p-4 sm:p-5"><InviteMemberQuickForm businessId={business.id} /></div>
            </details>
          ) : null}

          <details className="merchant-surface-bordered group">
            <summary className="merchant-action-row cursor-pointer list-none"><span className="portal-icon-tile"><ShieldCheck className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-portal-ink">Riwayat undangan</span><span className="block text-xs text-portal-soft">Diterima, menunggu, ditolak, atau kedaluwarsa.</span></span><span className="text-xs font-black text-portal-forest">{invitations.length}</span></summary>
            <div className="border-t border-portal-line/70">
              {invitations.length ? invitations.map(invitation => (
                <article key={invitation.id} className="merchant-action-row"><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-portal-ink">{invitation.inviteeUsername ? `@${invitation.inviteeUsername}` : 'Akun Lajukan'}</p><p className="mt-0.5 text-[11px] text-portal-soft">{organizationRoleLabel(invitation.role)} · {displayDate(invitation.createdAt)}</p></div><StatusBadge tone={invitation.status === 'accepted' ? 'success' : invitation.status === 'pending' ? 'warning' : 'neutral'}>{invitationStatusLabel(invitation.status)}</StatusBadge></article>
              )) : <p className="p-4 text-sm text-portal-soft">Belum ada riwayat undangan.</p>}
            </div>
          </details>
        </div>
      )}
    </PortalShell>
  );
}
