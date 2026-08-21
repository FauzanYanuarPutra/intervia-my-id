import { notFound } from 'next/navigation';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { BusinessInfoQuickForm } from '@/components/forms/BusinessInfoQuickForm';
import { BusinessLocationMap } from '@/components/maps/BusinessLocationMap';
import { buildBusinessLocationQuery } from '@/lib/portal-links';
import { toLatLng } from '@/lib/maps';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BusinessInfoPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;

  if (!business) {
    notFound();
  }

  const canManage = hasPermission(business, 'manageInfo');
  const businessPoint = toLatLng(business.latitude, business.longitude);
  const businessLocationQuery = buildBusinessLocationQuery({
    name: business.name,
    address: business.address,
    city: business.city,
    locationQuery: business.locationQuery,
  });

  return (
    <PortalShell
      activeBusiness={business}
      availableBusinesses={businesses}
      viewerName={account?.name ?? null}
      currentSection="info"
    >
      <SectionCard
        eyebrow="Info usaha"
        title="Rapikan identitas toko"
        description="Data inti toko."
      >
        <div className="grid gap-5">
          <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
            <p className="portal-kicker">{canManage ? 'Edit cepat' : 'Ringkasan info'}</p>
            {canManage ? (
              <div className="mt-4">
                <BusinessInfoQuickForm business={business} />
              </div>
            ) : (
              <dl className="mt-4 grid gap-4 text-sm">
                <div>
                  <dt className="font-semibold text-portal-ink">Nama usaha</dt>
                  <dd className="mt-1 text-portal-soft">{business.name}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-portal-ink">Kategori</dt>
                  <dd className="mt-1 text-portal-soft">{business.category}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-portal-ink">Deskripsi</dt>
                  <dd className="mt-1 leading-7 text-portal-soft">
                    {business.description}
                  </dd>
                </div>
              </dl>
            )}
          </article>

          <article className="rounded-[24px] border border-portal-line/70 bg-white p-5">
            <p className="portal-kicker">Preview pembeli</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                <p className="portal-label">Nama usaha</p>
                <p className="mt-1 text-sm font-semibold text-portal-ink">
                  {business.name}
                </p>
              </div>
              <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                <p className="portal-label">Nomor kontak</p>
                <p className="mt-1 text-sm font-semibold text-portal-ink">
                  {business.phone}
                </p>
              </div>
              <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                <p className="portal-label">Kota</p>
                <p className="mt-1 text-sm font-semibold text-portal-ink">
                  {business.city}
                </p>
              </div>
              <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                <p className="portal-label">Jam buka</p>
                <p className="mt-1 text-sm font-semibold text-portal-ink">
                  {business.schedule}
                </p>
              </div>
              <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3 sm:col-span-2">
                <p className="portal-label">Alamat</p>
                <p className="mt-1 text-sm font-semibold text-portal-ink">
                  {business.address}
                </p>
              </div>
              <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3 sm:col-span-2">
                <p className="portal-label">Lokasi & peta</p>
                <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px]">
                  <BusinessLocationMap
                    value={businessPoint}
                    searchQuery={businessLocationQuery}
                    markerLabel={business.name}
                    heightClassName="h-[220px] w-full"
                  />
                  <div className="grid gap-3">
                    <a
                      href={business.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="portal-button-secondary min-h-10 px-4"
                    >
                      Buka Google Maps
                    </a>
                    <a
                      href={business.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="portal-button-secondary min-h-10 px-4"
                    >
                      Buka storefront 3000
                    </a>
                    <div className="rounded-[18px] border border-portal-line/70 bg-white px-4 py-3 text-sm text-portal-soft">
                      {business.locationQuery}
                    </div>
                    {businessPoint ? (
                      <div className="rounded-[18px] border border-portal-line/70 bg-white px-4 py-3 text-sm font-semibold text-portal-ink">
                        Lat {businessPoint.lat} | Lng {businessPoint.lng}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
