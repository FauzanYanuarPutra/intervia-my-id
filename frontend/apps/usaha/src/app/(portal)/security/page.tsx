import Link from 'next/link';
import { KeyRound, ShieldCheck, Smartphone, UserRoundCheck } from 'lucide-react';
import { DataPanel } from '@/components/portal/DataPanel';
import { EmptyState } from '@/components/portal/EmptyState';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { readSingleParam } from '@/lib/portal-logic';
import { resolvePortalHomeState } from '@/lib/portal-server';

type PageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SecurityPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const state = readSingleParam(resolvedSearchParams, 'state');
  const { account, businesses: availableBusinesses, activeBusiness } = state === 'guest'
    ? { account: null, businesses: [], activeBusiness: null }
    : await resolvePortalHomeState(resolvedSearchParams);
  const scopeBusiness = activeBusiness;

  return (
    <PortalShell activeBusiness={scopeBusiness} availableBusinesses={availableBusinesses} viewerName={account?.name ?? null} currentSection="security">
      <SectionCard eyebrow="Tim & keamanan" title="Keamanan" description="Pahami perlindungan workspace, verifikasi aksi sensitif, dan aktivitas penting tanpa membuat operasional sehari-hari terasa rumit.">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4">
            <DataPanel title="Lapisan perlindungan" description="Kontrol yang paling penting untuk menjaga akses ke usaha.">
              <div className="divide-y divide-portal-line">
                {[
                  { icon: KeyRound, title: 'PIN usaha', description: 'Dipakai sebagai lapisan tambahan untuk undang anggota, ubah jabatan, dan aksi sensitif lainnya.', status: 'Aksi sensitif' },
                  { icon: Smartphone, title: 'Verifikasi ulang', description: 'OTP atau verifikasi tambahan hanya diminta ketika tindakan memiliki risiko lebih tinggi.', status: 'Sesuai risiko' },
                  { icon: ShieldCheck, title: 'Log aktivitas', description: 'Perubahan akses dan aktivitas penting dapat ditelusuri per usaha.', status: 'Tercatat' },
                  { icon: UserRoundCheck, title: 'Akses berbasis peran', description: 'Owner, manager, cashier, dan viewer mendapatkan kemampuan sesuai izin yang telah ditentukan.', status: 'Berbasis peran' },
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <article key={item.title} className="flex items-start gap-4 px-4 py-5 sm:px-5">
                      <span className="portal-icon-tile shrink-0"><Icon className="h-4 w-4" /></span>
                      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-portal-ink">{item.title}</h3><StatusBadge tone="success">{item.status}</StatusBadge></div><p className="mt-1.5 text-sm leading-6 text-portal-soft">{item.description}</p></div>
                    </article>
                  );
                })}
              </div>
            </DataPanel>

            {scopeBusiness ? (
              <DataPanel title="Kelola akses dari halaman Tim" description="Penambahan anggota dan pembagian peran tetap dikelola dari satu tempat agar audit akses lebih mudah.">
                <div className="p-4 sm:p-5"><Link href={`/businesses/${scopeBusiness.id}/team`} className="portal-button-primary">Buka Tim & Akses</Link></div>
              </DataPanel>
            ) : null}
          </div>

          <DataPanel title="Aktivitas terbaru" description={scopeBusiness ? `Peristiwa keamanan pada ${scopeBusiness.name}.` : 'Pilih usaha untuk melihat aktivitas keamanan.'}>
            {scopeBusiness?.securityEvents.length ? (
              <div className="divide-y divide-portal-line">
                {scopeBusiness.securityEvents.map(event => (
                  <article key={event.id} className="px-4 py-4 sm:px-5">
                    <p className="font-bold text-portal-ink">{event.title}</p>
                    <p className="mt-1 text-sm leading-6 text-portal-soft">{event.description}</p>
                    <p className="mt-2 text-[11px] font-semibold text-portal-soft">{event.time}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title={scopeBusiness ? 'Belum ada aktivitas keamanan' : 'Belum ada usaha aktif'} description={scopeBusiness ? 'Peristiwa keamanan penting akan muncul di bagian ini.' : 'Aktivitas keamanan ditampilkan setelah workspace usaha tersedia.'} icon={ShieldCheck} />
            )}
          </DataPanel>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
