import { redirect } from 'next/navigation';
import { CheckCircle2, Layers3, MapPinned, Store } from 'lucide-react';
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
        <PageHeader
          eyebrow="Onboarding usaha"
          title="Buat workspace usaha baru"
          description="Pilih jenis usaha, isi identitas dan lokasi utama. Lajukan menyiapkan flow awal yang sesuai tanpa memaksa kamu memahami ERP atau akuntansi."
        />

        <section className="grid gap-3 sm:grid-cols-4">
          {[
            [Layers3, '1. Pilih flow', 'Juice/F&B, Laundry, AC/Field Service, Mart/Retail, atau usaha umum.'],
            [Store, '2. Identitas usaha', 'Nama, kategori tampilan, dan kontak utama.'],
            [MapPinned, '3. Lokasi utama', 'Alamat dan pin menjadi fondasi cabang pertama.'],
            [CheckCircle2, '4. Quick Start', 'Masuk ke langkah awal yang relevan dengan jenis usahamu.'],
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

        <DataPanel
          title="Setup usaha"
          description="Jenis usaha menentukan template dan capability awal. Kategori tetap terpisah agar label publik tidak diam-diam mengubah operasional."
        >
          <div className="p-4 sm:p-6">
            <NewBusinessQuickForm
              initialOwnerName={account.name}
              initialOwnerPhone={account.phone}
              initialOwnerEmail={account.email}
            />
          </div>
        </DataPanel>
      </div>
    </PortalShell>
  );
}
