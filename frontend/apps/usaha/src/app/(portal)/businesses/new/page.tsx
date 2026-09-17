import { redirect } from 'next/navigation';
import { CheckCircle2, MapPinned, Store } from 'lucide-react';
import { NewBusinessQuickForm } from '@/components/forms/NewBusinessQuickForm';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { getPortalAccount, getPortalBusinesses } from '@/lib/portal-server';

export default async function NewBusinessPage() {
  const account = await getPortalAccount();
  if (!account) redirect('/login?callbackUrl=/businesses/new');
  const businesses = await getPortalBusinesses();

  return (
    <PortalShell activeBusiness={null} availableBusinesses={businesses} viewerName={account.name} currentSection="home" pageTitle="Tambah usaha">
      <div className="mx-auto max-w-3xl space-y-4 py-1 sm:py-3">
        <PageHeader
          eyebrow="Mulai"
          title="Tambah usaha"
          description="Isi yang penting dulu. Produk, stok, uang, dan pengaturan lain bisa dilengkapi setelah usaha dibuat."
        />

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
