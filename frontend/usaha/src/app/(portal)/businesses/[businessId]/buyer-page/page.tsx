import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
import { BusinessLocationMap } from '@/components/maps/BusinessLocationMap';
import { buildBusinessLocationQuery } from '@/lib/portal-links';
import { toLatLng } from '@/lib/maps';

type PageProps = {
  params: Promise<{ businessId: string }>;
};

export default async function BuyerPagePreview({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } =
    await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;

  if (!business) {
    notFound();
  }

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
      currentSection="buyerPage"
    >
      <SectionCard
        eyebrow="Halaman pembeli"
        title="Cek toko dari sudut pandang pembeli"
        description="Preview publik."
      >
        <div className="grid gap-5">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <article className="rounded-[28px] border border-portal-line/70 bg-white p-5">
              <p className="portal-kicker">Status tampilan publik</p>
              <h3 className="mt-2 text-xl font-bold tracking-[-0.04em] text-portal-ink">
                {business.buyerPageReady
                  ? 'Sudah siap dibuka ke pembeli'
                  : 'Masih perlu dirapikan'}
              </h3>
              <p className="mt-3 text-sm leading-7 text-portal-soft">
                {business.buyerPageReady
                  ? 'Info usaha, produk, dan status buka sudah cukup meyakinkan untuk dibagikan.'
                  : 'Masih ada bagian penting yang perlu dibereskan sebelum halaman pembeli terasa rapi.'}
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                  <p className="portal-label">URL publik</p>
                  <p className="mt-1 text-sm font-semibold text-portal-ink">
                    {business.publicUrl}
                  </p>
                </div>
                <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                  <p className="portal-label">Produk aktif</p>
                  <p className="mt-1 text-sm font-semibold text-portal-ink">
                    {business.productsCount} item
                  </p>
                </div>
                <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                  <p className="portal-label">Titipan aktif</p>
                  <p className="mt-1 text-sm font-semibold text-portal-ink">
                    {business.consignmentProductsCount ?? 0} item
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
                <BusinessLocationMap
                  value={businessPoint}
                  searchQuery={businessLocationQuery}
                  markerLabel={business.name}
                  heightClassName="h-[220px] w-full"
                />
                <div className="grid gap-3">
                  <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                    <p className="portal-label">Alamat publik</p>
                    <p className="mt-1 text-sm font-semibold text-portal-ink">
                      {business.address}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                    <p className="portal-label">Kota</p>
                    <p className="mt-1 text-sm font-semibold text-portal-ink">
                      {business.city}
                    </p>
                  </div>
                  {businessPoint ? (
                    <div className="rounded-[20px] border border-portal-line/70 bg-portal-sand/35 px-4 py-3">
                      <p className="portal-label">Koordinat</p>
                      <p className="mt-1 text-sm font-semibold text-portal-ink">
                        {businessPoint.lat}, {businessPoint.lng}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>

            <article className="rounded-[28px] border border-portal-line/70 bg-portal-sand/45 p-5">
              <p className="portal-kicker">Aksi cepat</p>
              <div className="mt-4 grid gap-3">
                <Link href={business.publicUrl} className="portal-button-primary min-h-11 px-4">
                  Buka halaman pembeli di 3000
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <Link href={business.googleMapsUrl} className="portal-button-secondary min-h-11 px-4">
                  Buka Google Maps
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <Link href={`/businesses/${business.id}/info`} className="portal-button-secondary min-h-11 px-4">
                  Kembali ke info usaha
                </Link>
              </div>
            </article>
          </div>
        </div>
      </SectionCard>
    </PortalShell>
  );
}
