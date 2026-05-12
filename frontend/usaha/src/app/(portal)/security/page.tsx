import Link from 'next/link';
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { businesses } from '@/lib/portal-data';
import { readSingleParam } from '@/lib/portal-logic';
import { resolvePortalHomeState } from '@/lib/portal-server';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SecurityPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const state = readSingleParam(resolvedSearchParams, 'state');
  const { account, businesses: availableBusinesses, activeBusiness } =
    state === 'guest'
      ? { account: null, businesses: [], activeBusiness: null }
      : await resolvePortalHomeState(resolvedSearchParams);
  const scopeBusiness = activeBusiness ?? businesses[0] ?? null;

  return (
    <PortalShell
      activeBusiness={scopeBusiness}
      availableBusinesses={availableBusinesses}
      viewerName={account?.name ?? null}
      currentSection="security"
    >
      <SectionCard
        eyebrow="Keamanan usaha"
        title="Aman, tapi tetap gampang dipakai"
        description="Akses dan aktivitas penting."
      >
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_360px]">
            <div className="grid gap-4">
              <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-portal-sand text-portal-forest">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="portal-kicker">PIN usaha</p>
                    <p className="mt-2 text-sm leading-6 text-portal-soft">
                      Dipakai untuk undang anggota, ubah jabatan, dan aksi sensitif lain
                      supaya akun yang bocor tidak langsung membahayakan seluruh usaha.
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-portal-sand text-portal-forest">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="portal-kicker">Verifikasi ulang</p>
                    <p className="mt-2 text-sm leading-6 text-portal-soft">
                      Kode OTP atau verifikasi tambahan hanya diminta saat pengguna mencoba
                      aksi yang memang berisiko tinggi.
                    </p>
                  </div>
                </div>
              </article>

              <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-portal-sand text-portal-forest">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="portal-kicker">Log aktivitas</p>
                    <p className="mt-2 text-sm leading-6 text-portal-soft">
                      Owner perlu tahu siapa login, siapa kirim undangan, dan siapa mengubah
                      akses. Semua itu dicatat per usaha.
                    </p>
                  </div>
                </div>
              </article>
            </div>

            <div className="rounded-[28px] border border-portal-line/70 bg-portal-sand/45 p-5">
              <p className="portal-kicker">Aktivitas terbaru</p>
              <div className="mt-4 grid gap-3">
                {scopeBusiness?.securityEvents.map(event => (
                  <article
                    key={event.id}
                    className="rounded-[20px] border border-portal-line/70 bg-white px-4 py-3"
                  >
                    <p className="font-semibold text-portal-ink">{event.title}</p>
                    <p className="mt-1 text-sm leading-6 text-portal-soft">
                      {event.description}
                    </p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-portal-soft">
                      {event.time}
                    </p>
                  </article>
                ))}
              </div>
              {scopeBusiness ? (
                <Link href={`/businesses/${scopeBusiness.id}/team`} className="portal-button-primary mt-5 min-h-11 px-4">
                  Kembali ke tim dan akses
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
