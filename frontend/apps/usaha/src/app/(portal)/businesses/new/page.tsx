import { redirect } from 'next/navigation';
import { CheckCircle2, MapPinned, Store } from 'lucide-react';
import { NewBusinessQuickForm } from '@/components/forms/NewBusinessQuickForm';
import { DataPanel } from '@/components/portal/DataPanel';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { getPortalAccount, getPortalBusinesses } from '@/lib/portal-server';

export default async function NewBusinessPage() {
  const account = await getPortalAccount();
  if (!account) redirect('/login?callbackUrl=/businesses/new');
  const businesses = await getPortalBusinesses();

  return (
    <PortalShell activeBusiness={null} availableBusinesses={businesses} viewerName={account.name} currentSection="home">
      <div className="mx-auto max-w-5xl space-y-5 py-2 sm:py-4">
        <PageHeader eyebrow="Onboarding usaha" title="Buat workspace usaha baru" description="Isi identitas dasar dan lokasi utama. Setelah tersimpan, kamu langsung masuk ke Business OS untuk melengkapi katalog dan operasional." />

        <section className="grid gap-3 sm:grid-cols-3">
          {[
            [Store, '1. Identitas usaha', 'Nama, kategori, kontak, dan deskripsi utama.'],
            [MapPinned, '2. Lokasi utama', 'Alamat dan pin membantu pembeli menemukan usaha.'],
            [CheckCircle2, '3. Siap dikelola', 'Lanjutkan ke dashboard, produk, order, dan tim.'],
          ].map(([Icon, title, copy]) => {
            const IconComponent = Icon as typeof Store;
            return (
              <article key={String(title)} className="portal-panel p-4 sm:p-5">
                <span className="portal-icon-tile"><IconComponent className="h-4 w-4" /></span>
                <h2 className="mt-4 text-sm font-bold text-portal-ink">{String(title)}</h2>
                <p className="mt-1.5 text-xs leading-5 text-portal-soft">{String(copy)}</p>
              </article>
            );
          })}
        </section>

        <DataPanel title="Informasi usaha" description="Data ini menjadi fondasi profil usaha dan lokasi utama yang dikelola dari Lajukan Usaha.">
          <div className="p-4 sm:p-6"><NewBusinessQuickForm initialOwnerName={account.name} initialOwnerPhone={account.phone} initialOwnerEmail={account.email} /></div>
        </DataPanel>
      </div>
    </PortalShell>
  );
}
