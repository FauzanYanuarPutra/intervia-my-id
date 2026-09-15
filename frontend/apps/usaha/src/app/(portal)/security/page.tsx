import Link from 'next/link';
import { KeyRound, ShieldCheck, Smartphone, UserRoundCheck } from 'lucide-react';
import { EmptyState } from '@/components/portal/EmptyState';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { readSingleParam } from '@/lib/portal-logic';
import { resolvePortalHomeState } from '@/lib/portal-server';

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const protections = [
  {
    icon: KeyRound,
    title: 'PIN usaha',
    description: 'Lapisan tambahan untuk aksi sensitif.',
    status: 'Aktif saat perlu',
  },
  {
    icon: Smartphone,
    title: 'Verifikasi ulang',
    description: 'Verifikasi tambahan hanya saat risikonya lebih tinggi.',
    status: 'Sesuai risiko',
  },
  {
    icon: ShieldCheck,
    title: 'Log aktivitas',
    description: 'Perubahan akses dan aktivitas penting dapat ditelusuri.',
    status: 'Tercatat',
  },
  {
    icon: UserRoundCheck,
    title: 'Akses berbasis peran',
    description: 'Pemilik, manager, kasir, dan viewer mendapat akses sesuai tugasnya.',
    status: 'Berbasis peran',
  },
] as const;

export default async function SecurityPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const state = readSingleParam(resolvedSearchParams, 'state');
  const { account, businesses: availableBusinesses, activeBusiness } = state === 'guest'
    ? { account: null, businesses: [], activeBusiness: null }
    : await resolvePortalHomeState(resolvedSearchParams);
  const scopeBusiness = activeBusiness;

  return (
    <PortalShell
      activeBusiness={scopeBusiness}
      availableBusinesses={availableBusinesses}
      viewerName={account?.name ?? null}
      currentSection="security"
    >
      <div className="mx-auto max-w-5xl space-y-4">
        <PageHeader
          eyebrow="Akun"
          title="Keamanan akun"
          description="Perlindungan penting tetap aktif tanpa memenuhi pekerjaan harian dengan istilah teknis."
          action={scopeBusiness ? (
            <Link href={`/businesses/${scopeBusiness.id}/team`} className="portal-button-primary">
              Tim & Akses
            </Link>
          ) : null}
        />

        <section className="merchant-list border border-portal-line/80">
          {protections.map(item => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="merchant-action-row">
                <span className="portal-icon-tile">
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-portal-ink">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-portal-soft">{item.description}</p>
                </div>
                <StatusBadge tone="success">{item.status}</StatusBadge>
              </article>
            );
          })}
        </section>

        <section>
          <div className="mb-2.5">
            <h2 className="font-black text-portal-ink">Aktivitas keamanan</h2>
            <p className="mt-0.5 text-xs text-portal-soft">
              {scopeBusiness ? `Peristiwa penting pada ${scopeBusiness.name}.` : 'Pilih usaha untuk melihat aktivitas keamanan.'}
            </p>
          </div>
          <div className="merchant-list border border-portal-line/80">
            {scopeBusiness?.securityEvents.length ? (
              scopeBusiness.securityEvents.map(event => (
                <article key={event.id} className="merchant-action-row">
                  <span className="portal-icon-tile">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-portal-ink">{event.title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-portal-soft">{event.description}</p>
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold text-portal-soft">{event.time}</span>
                </article>
              ))
            ) : (
              <EmptyState
                title={scopeBusiness ? 'Belum ada aktivitas keamanan' : 'Belum ada usaha aktif'}
                description={scopeBusiness ? 'Peristiwa keamanan penting akan muncul di sini.' : 'Aktivitas keamanan tersedia setelah workspace usaha aktif.'}
                icon={ShieldCheck}
              />
            )}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
