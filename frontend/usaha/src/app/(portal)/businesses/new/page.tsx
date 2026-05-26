import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, MapPinned, Phone, Store } from 'lucide-react';
import { NewBusinessQuickForm } from '@/components/forms/NewBusinessQuickForm';
import { PortalShell } from '@/components/portal/PortalShell';
import { getPortalAccount, getPortalBusinesses } from '@/lib/portal-server';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewBusinessPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const account = await getPortalAccount();
  const businesses = await getPortalBusinesses();
  const ownerName =
    typeof resolvedSearchParams.ownerName === 'string'
      ? resolvedSearchParams.ownerName
      : account?.name ?? '';
  const ownerPhone =
    typeof resolvedSearchParams.ownerPhone === 'string'
      ? resolvedSearchParams.ownerPhone
      : account?.phone ?? '';
  const ownerEmail =
    typeof resolvedSearchParams.ownerEmail === 'string'
      ? resolvedSearchParams.ownerEmail
      : account?.email ?? '';

  return (
    <PortalShell
      activeBusiness={null}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="home"
    >
      <section className="portal-panel overflow-hidden">
        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_300px]">
          <article className="min-w-0 p-4 sm:p-5 lg:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="portal-kicker">Buat usaha</p>
                <h1 className="mt-1 text-[1.55rem] font-black tracking-[-0.05em] text-portal-ink sm:text-[2rem]">
                  Usaha baru, siap dikelola.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-portal-soft">
                  Isi data wajib dulu. Foto, produk, dan detail lain bisa dilengkapi setelah dashboard terbuka.
                </p>
              </div>

              <Link
                href="/"
                className="portal-button-secondary min-h-10 shrink-0 px-3 text-xs"
              >
                Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {[
                {
                  title: 'Info inti',
                  copy: 'Nama, kategori, kota.',
                  icon: Store,
                },
                {
                  title: 'Kontak aktif',
                  copy: 'Nomor usaha untuk chat.',
                  icon: Phone,
                },
                {
                  title: 'Lokasi nanti',
                  copy: 'Peta opsional dulu.',
                  icon: MapPinned,
                },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex min-w-0 items-center gap-3 rounded-[18px] border border-portal-line/70 bg-white/75 px-3 py-2.5"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-portal-forest/10 text-portal-forest">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-black text-portal-ink">{item.title}</span>
                      <span className="block truncate text-xs text-portal-soft">{item.copy}</span>
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 rounded-[22px] border border-portal-line/70 bg-white/80 p-3 shadow-[0_18px_44px_-38px_rgba(31,41,55,0.22)] sm:p-4">
              <NewBusinessQuickForm
                initialOwnerName={ownerName}
                initialOwnerPhone={ownerPhone}
                initialOwnerEmail={ownerEmail}
              />
            </div>
          </article>

          <aside className="border-t border-portal-line/70 bg-portal-sand/25 p-4 sm:p-5 xl:border-l xl:border-t-0">
            <div className="sticky top-4 space-y-3">
              <div className="rounded-[20px] border border-portal-line/70 bg-white/80 p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-portal-forest text-white">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-portal-ink">Target: 2 menit</p>
                    <p className="mt-1 text-xs leading-5 text-portal-soft">
                      Cukup data yang bikin usaha bisa dicari dan dihubungi.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-portal-line/70 bg-white/80 p-4">
                <p className="text-sm font-black text-portal-ink">Setelah simpan</p>
                <div className="mt-3 grid gap-2">
                  {['Masuk dashboard', 'Lengkapi foto/logo', 'Tambah produk atau jasa'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-sm text-portal-soft">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-portal-forest" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {!account ? (
                <div className="rounded-[20px] border border-portal-line/70 bg-white/80 p-4">
                  <p className="text-sm font-black text-portal-ink">Sudah punya akun?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href="/login" className="portal-button-secondary min-h-10 px-3 text-xs">
                      Masuk
                    </Link>
                    <Link href="/register" className="portal-button-secondary min-h-10 px-3 text-xs">
                      Daftar
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </PortalShell>
  );
}
