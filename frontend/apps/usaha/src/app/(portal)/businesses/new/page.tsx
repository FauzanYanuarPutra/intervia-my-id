import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, MapPinned, Store } from 'lucide-react';
import { NewBusinessQuickForm } from '@/components/forms/NewBusinessQuickForm';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { resolvePortalHomeState } from '@/lib/portal-server';

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const forceNew = query.new === '1';
  const state = await resolvePortalHomeState({});
  if (!state.isAuthenticated) redirect('/login?callbackUrl=/businesses/new');

  if (!forceNew) {
    if (state.businessesProvisioning) {
      redirect('/');
    }
    if (state.businesses.length === 1 && state.activeBusiness) {
      redirect(`/?business=${encodeURIComponent(state.activeBusiness.id)}`);
    }
  }

  const account = state.account;
  const businesses = state.businesses;

  if (!forceNew && businesses.length > 1) {
    return (
      <PortalShell
        activeBusiness={null}
        availableBusinesses={businesses}
        viewerName={account.name}
        currentSection="home"
        pageTitle="Pilih usaha"
      >
        <div className="mx-auto max-w-3xl space-y-4 py-1 sm:py-3">
          <PageHeader
            eyebrow="Akun Lajukan"
            title="Usaha mana yang mau kamu buka?"
            description="Akun ini terhubung ke beberapa usaha. Pilih salah satunya supaya data dan aktivitasnya tetap berada di workspace yang benar."
          />
          <section className="merchant-surface-bordered overflow-hidden p-2 sm:p-3">
            <div className="grid gap-2">
              {businesses.map(business => (
                <Link
                  key={business.id}
                  href={`/?business=${encodeURIComponent(business.id)}`}
                  className="group flex min-h-16 items-center gap-3 rounded-2xl border border-portal-line bg-white px-3.5 py-3 transition hover:border-portal-forest/30 hover:bg-portal-mist/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/20"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-portal-mist text-portal-forest">
                    <Store className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black text-portal-ink">{business.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-portal-soft">{business.city || 'Lokasi belum diatur'} · {business.category}</span>
                  </span>
                  <span className="shrink-0 text-xs font-black text-portal-forest">Buka</span>
                </Link>
              ))}
            </div>
          </section>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/" className="portal-button-secondary">Kembali ke workspace</Link>
            <Link href="/businesses/new?new=1" className="portal-button-primary">
              Buat usaha baru
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell activeBusiness={null} availableBusinesses={businesses} viewerName={account.name} currentSection="home" pageTitle={forceNew ? 'Buat usaha baru' : 'Tambah usaha'}>
      <div className="mx-auto max-w-3xl space-y-4 py-1 sm:py-3">
        <PageHeader
          eyebrow={forceNew ? 'Usaha baru' : 'Mulai'}
          title={forceNew ? 'Buat usaha baru' : 'Tambah usaha'}
          description={
            forceNew
              ? 'Ini benar-benar membuat workspace usaha baru. Usaha yang sudah ada tetap tersimpan dan tidak diubah.'
              : 'Isi yang penting dulu. Setelah masuk, Lajukan akan memeriksa dulu apakah akunmu sudah punya usaha.'
          }
        />
        {forceNew ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs leading-5 text-amber-900">
            <span>Yakin mau membuat usaha baru? Data usaha yang sudah ada tidak akan dihapus.</span>
            <Link href="/" className="font-black text-amber-950 underline decoration-amber-300 underline-offset-2">
              Kembali ke workspace
            </Link>
          </div>
        ) : null}

        <section className="merchant-surface-bordered overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-portal-line/70 border-b border-portal-line/70 bg-[#fafbf9]">
            <div className="px-3 py-3 text-center"><Store className="mx-auto h-4 w-4 text-portal-forest" /><p className="mt-1 text-[11px] font-bold text-portal-ink">Info usaha</p></div>
            <div className="px-3 py-3 text-center"><MapPinned className="mx-auto h-4 w-4 text-portal-forest" /><p className="mt-1 text-[11px] font-bold text-portal-ink">Lokasi</p></div>
            <div className="px-3 py-3 text-center"><CheckCircle2 className="mx-auto h-4 w-4 text-portal-forest" /><p className="mt-1 text-[11px] font-bold text-portal-ink">Siap dipakai</p></div>
          </div>
          <div className="p-4 sm:p-6">
            <NewBusinessQuickForm
              initialOwnerName={account.name}
              initialOwnerPhone={account.phone}
              initialOwnerEmail={account.email}
            />
          </div>
        </section>

        <p className="px-1 text-xs leading-5 text-portal-soft">Tidak perlu menyiapkan semua data sekarang. Setelah usaha tersimpan, Lajukan akan menampilkan pekerjaan berikutnya yang paling relevan.</p>
      </div>
    </PortalShell>
  );
}
