import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Clock3, ExternalLink, ImageIcon, MapPinned, Store, UsersRound } from 'lucide-react';
import { BusinessInfoQuickForm } from '@/components/forms/BusinessInfoQuickForm';
import { BusinessImageCropUpload } from '@/components/media/BusinessImageCropUpload';
import { BusinessVerificationPanel } from '@/components/forms/BusinessVerificationPanel';
import { BusinessLocationMap } from '@/components/maps/BusinessLocationMap';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import { StatusBadge } from '@/components/portal/StatusBadge';
import { hasPermission } from '@/lib/portal-logic';
import { buildBusinessLocationQuery } from '@/lib/portal-links';
import { toLatLng } from '@/lib/maps';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessInfoPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canManage = hasPermission(business, 'manageInfo');
  const canViewTeam = hasPermission(business, 'viewTeam');
  const businessPoint = toLatLng(business.latitude, business.longitude);
  const businessLocationQuery = buildBusinessLocationQuery({ name: business.name, address: business.address, city: business.city, locationQuery: business.locationQuery });
  const verificationChecks = {
    profile: business.infoComplete,
    image: Boolean(business.logoUrl),
    contact: Boolean(business.phone),
    location: business.latitude !== null && business.longitude !== null,
  };
  const verificationReady = Object.values(verificationChecks).every(Boolean);

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="info">
      <PageHeader eyebrow="Pengaturan Usaha" title={canManage ? 'Kelola usaha' : 'Info usaha'} description={canManage ? 'Ubah yang perlu saja. Data teknis tetap tersedia tanpa memenuhi layar utama.' : 'Lihat informasi usaha yang dibagikan sesuai aksesmu.'} />

      <section className="merchant-list border border-portal-line/80">
        <details className="group border-b border-portal-line/70">
          <summary className="merchant-action-row cursor-pointer list-none">
            <span className="portal-icon-tile"><Store className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black text-portal-ink">Info usaha</span><span className="mt-0.5 block truncate text-xs text-portal-soft">{business.name} · {business.category}</span></span>
            <StatusBadge tone={business.infoComplete ? 'success' : 'warning'}>{business.infoComplete ? 'Lengkap' : 'Lengkapi'}</StatusBadge>
          </summary>
          <div className="border-t border-portal-line/70 p-4 sm:p-5">
            {canManage ? <BusinessInfoQuickForm business={business} /> : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div><dt className="portal-label">Nama usaha</dt><dd className="mt-1 text-sm font-semibold text-portal-ink">{business.name}</dd></div>
                <div><dt className="portal-label">Kategori</dt><dd className="mt-1 text-sm font-semibold text-portal-ink">{business.category}</dd></div>
                <div className="sm:col-span-2"><dt className="portal-label">Deskripsi</dt><dd className="mt-1 text-sm leading-6 text-portal-soft">{business.description || 'Belum ada deskripsi.'}</dd></div>
              </dl>
            )}
          </div>
        </details>

        <details className="group border-b border-portal-line/70">
          <summary className="merchant-action-row cursor-pointer list-none">
            <span className="portal-icon-tile"><ImageIcon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black text-portal-ink">Foto & logo</span><span className="mt-0.5 block text-xs text-portal-soft">Logo dan banner tampilan toko</span></span>
            <span className="text-xs font-black text-portal-forest">{canManage ? 'Atur' : 'Lihat'}</span>
          </summary>
          <div className="grid gap-6 border-t border-portal-line/70 p-4 sm:p-5 lg:grid-cols-[220px_minmax(0,1fr)]">
            {canManage ? <BusinessImageCropUpload businessId={business.id} kind="logo" currentUrl={business.logoUrl} label="Logo / foto usaha" description="Rasio 1:1 untuk kartu usaha dan foto toko." /> : <div className="aspect-square rounded-2xl bg-[#f3f5f1] bg-cover bg-center" style={business.logoUrl ? { backgroundImage: `url(${business.logoUrl})` } : undefined} />}
            {canManage ? <BusinessImageCropUpload businessId={business.id} kind="banner" currentUrl={business.bannerUrl} label="Banner usaha" description="Rasio 8:3 untuk bagian atas tampilan toko." /> : <div className="aspect-[8/3] rounded-2xl bg-[#f3f5f1] bg-cover bg-center" style={business.bannerUrl ? { backgroundImage: `url(${business.bannerUrl})` } : undefined} />}
          </div>
        </details>

        <details className="group border-b border-portal-line/70">
          <summary className="merchant-action-row cursor-pointer list-none">
            <span className="portal-icon-tile"><MapPinned className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black text-portal-ink">Lokasi utama</span><span className="mt-0.5 block truncate text-xs text-portal-soft">{business.address || 'Alamat belum lengkap'} · {business.city}</span></span>
            <span className="text-xs font-black text-portal-forest">Lihat</span>
          </summary>
          <div className="grid gap-4 border-t border-portal-line/70 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_280px]">
            <BusinessLocationMap value={businessPoint} searchQuery={businessLocationQuery} markerLabel={business.name} heightClassName="h-[250px] w-full" />
            <div className="space-y-2">
              {canManage ? <Link href={`/businesses/${business.id}/locations`} className="portal-button-secondary w-full"><MapPinned className="h-4 w-4" /> Atur lokasi</Link> : null}
              <a href={business.googleMapsUrl} target="_blank" rel="noreferrer" className="portal-button-secondary w-full"><ExternalLink className="h-4 w-4" /> Google Maps</a>
              <a href={business.publicUrl} target="_blank" rel="noreferrer" className="portal-button-primary w-full"><Store className="h-4 w-4" /> Lihat Tampilan Toko</a>
            </div>
          </div>
        </details>

        <Link href={`/businesses/${business.id}/operations`} className="merchant-action-row">
          <span className="portal-icon-tile"><Clock3 className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1"><span className="block text-sm font-black text-portal-ink">Jam & operasional</span><span className="mt-0.5 block text-xs text-portal-soft">{business.schedule}</span></span>
          <span className="text-xs font-black text-portal-forest">Buka</span>
        </Link>

        {canViewTeam ? (
          <Link href={`/businesses/${business.id}/team`} className="merchant-action-row">
            <span className="portal-icon-tile"><UsersRound className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-black text-portal-ink">Tim & akses</span><span className="mt-0.5 block text-xs text-portal-soft">Atur siapa yang boleh mengelola usaha.</span></span>
            <span className="text-xs font-black text-portal-forest">Buka</span>
          </Link>
        ) : null}
      </section>

      {canManage ? (
        <BusinessVerificationPanel
          businessId={business.id}
          checks={verificationChecks}
          ready={verificationReady}
        />
      ) : null}
    </PortalShell>
  );
}
