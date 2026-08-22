import { redirect } from 'next/navigation';
import { CheckCircle2, MapPinned, Store } from 'lucide-react';
import { NewBusinessQuickForm } from '@/components/forms/NewBusinessQuickForm';
import { PortalShell } from '@/components/portal/PortalShell';
import { getPortalAccount, getPortalBusinesses } from '@/lib/portal-server';

export default async function NewBusinessPage() {
  const account = await getPortalAccount();
  if (!account) redirect('/login?callbackUrl=/businesses/new');
  const businesses = await getPortalBusinesses();
  return (
    <PortalShell activeBusiness={null} availableBusinesses={businesses} viewerName={account.name} currentSection="home">
      <section className="portal-panel overflow-hidden p-4 sm:p-6 lg:p-7">
        <p className="portal-kicker">Onboarding usaha</p>
        <h1 className="mt-1 text-[1.7rem] font-bold tracking-[-0.05em] sm:text-[2.2rem]">Buat usaha + lokasi utama.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-portal-soft">Workspace dibuat sebagai Organization di Identity, sedangkan profil bisnis dan titik lokasi tersimpan di Marketplace.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[[Store, 'Identitas', 'Nama, kategori, kontak.'], [MapPinned, 'Lokasi', 'Alamat dan pin wajib.'], [CheckCircle2, 'Siap dikelola', 'Masuk dashboard setelah simpan.']].map(([Icon, title, copy]) => { const I = Icon as typeof Store; return <div key={String(title)} className="rounded-[18px] border border-portal-line/70 bg-white p-3"><I className="h-4 w-4 text-portal-forest" /><p className="mt-2 text-sm font-bold">{String(title)}</p><p className="mt-1 text-xs text-portal-soft">{String(copy)}</p></div>; })}
        </div>
        <div className="mt-4 rounded-[22px] border border-portal-line/70 bg-white/90 p-3 sm:p-4"><NewBusinessQuickForm initialOwnerName={account.name} initialOwnerPhone={account.phone} initialOwnerEmail={account.email} /></div>
      </section>
    </PortalShell>
  );
}
