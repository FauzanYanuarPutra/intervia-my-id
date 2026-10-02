import { redirect } from 'next/navigation';
import { CheckCircle2, MapPinned, Store } from 'lucide-react';
import { ExistingBusinessesPanel } from '@/components/forms/ExistingBusinessesPanel';
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
  if (!state.isAuthenticated) redirect('/login?callbackUrl=/businesses/new?new=1');

  if (state.businessesProvisioning) redirect('/');

  if (!forceNew && state.activeBusiness) {
    redirect(`/?business=${encodeURIComponent(state.activeBusiness.id)}`);
  }

  const account = state.account;
  const businesses = state.businesses;
  const hasExistingBusinesses = businesses.length > 0;
  const pageTitle = hasExistingBusinesses ? 'Tambah usaha lain' : 'Tambah usaha';

  return (
    <PortalShell activeBusiness={null} availableBusinesses={businesses} viewerName={account.name} currentSection="home" pageTitle={pageTitle}>
      <div className="mx-auto max-w-3xl space-y-4 py-1 pb-8 sm:py-3">
        <PageHeader
          eyebrow="Mulai"
          title={pageTitle}
          description={
            hasExistingBusinesses
              ? 'Akun ini sudah punya usaha. Cek dulu usaha yang ada supaya tidak membuat data ganda.'
              : 'Isi yang penting dulu. Produk, stok, uang, dan pengaturan lain bisa dilengkapi setelah usaha dibuat.'
          }
        />

        <ExistingBusinessesPanel businesses={businesses} />

        <section id="new-business-form" className="merchant-surface-bordered scroll-mt-24 overflow-hidden">
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
