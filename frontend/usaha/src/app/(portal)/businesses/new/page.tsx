import Link from 'next/link';
import { CheckCircle2, MapPinned, Store } from 'lucide-react';
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
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="portal-panel p-5 sm:p-6">
          <p className="portal-kicker">Tambah usaha</p>
          <h1 className="mt-2 text-[1.75rem] font-black tracking-[-0.06em] text-portal-ink sm:text-[2.15rem]">
            Isi fondasi toko sekali, habis itu langsung jalan
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-portal-soft">Isi data inti, lalu masuk dashboard.</p>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              {
                title: '1. Identitas toko',
                copy: 'Nama, kategori, kota, dan alamat jadi dasar tampilan usaha.',
              },
              {
                title: '2. Titik lokasi',
                copy: 'Cari di peta, paste link maps, atau pakai lokasi saat ini.',
              },
              {
                title: '3. Masuk dashboard',
                copy: 'Sistem otomatis pilih langkah setup yang paling relevan.',
              },
            ].map(item => (
              <article key={item.title} className="portal-panel-muted p-4">
                <p className="text-sm font-black tracking-[-0.04em] text-portal-ink">
                  {item.title}
                </p>
                <p className="mt-2 text-sm leading-6 text-portal-soft">{item.copy}</p>
              </article>
            ))}
          </div>

          <div className="portal-panel-soft mt-5 p-5">
            <NewBusinessQuickForm
              initialOwnerName={ownerName}
              initialOwnerPhone={ownerPhone}
              initialOwnerEmail={ownerEmail}
            />
          </div>
        </article>

        <aside className="space-y-4">
          <div className="portal-panel p-5">
            <p className="portal-kicker">Checklist biar cepat rapi</p>
            <div className="mt-4 grid gap-3">
              {[
                'Nama usaha gampang dicari dan gampang disebut.',
                'Nomor usaha benar-benar aktif untuk telepon atau WhatsApp.',
                'Alamat singkat mudah dipahami kurir dan pembeli.',
                'Marker outlet sudah pas di peta.',
              ].map(item => (
                <div
                  key={item}
                  className="inline-flex items-start gap-2 rounded-[20px] border border-portal-line/70 bg-white px-4 py-3 text-sm text-portal-soft"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-portal-forest" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="portal-panel-muted p-5">
            <div className="flex items-start gap-3">
              <Store className="mt-0.5 h-5 w-5 text-portal-forest" />
              <div className="text-sm leading-6 text-portal-soft">
                Habis simpan, portal akan pilih fokus berikutnya: rapikan info, isi produk, atau
                atur operasional.
              </div>
            </div>
          </div>

          <div className="portal-panel p-5">
            <div className="flex items-start gap-3">
              <MapPinned className="mt-0.5 h-5 w-5 text-portal-forest" />
              <div className="text-sm leading-6 text-portal-soft">
                Link pembeli diarahkan ke `localhost:3000/toko/[slug]`, dan titik usaha bisa dicek
                langsung lewat preview peta.
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 text-sm">
              <Link href="/login" className="portal-button-secondary">
                Masuk dulu
              </Link>
              <Link href="/register" className="portal-button-secondary">
                Buat akun
              </Link>
            </div>
          </div>
        </aside>
      </section>
    </PortalShell>
  );
}
