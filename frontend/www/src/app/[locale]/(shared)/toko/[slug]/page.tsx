import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Clock3,
  ExternalLink,
  ImageOff,
  MapPin,
  MessageCircle,
  PackageCheck,
  Phone,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { LajukanImage } from '@/components/common/LajukanImage';
import { getBaseUrl } from '@/lib/server/getBaseUrl';
import {
  getUmkmStoreBySlug,
  listUmkmProducts,
  type UmkmProduct,
  type UmkmStore,
} from '@/lib/super-app/umkm-commerce';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import {
  projectPublicUmkmStore,
  type PublicUmkmStore,
} from '@/lib/super-app/umkm-public-store';
import { isPublicUmkmStoreVisible } from '@/lib/super-app/umkm-public-discovery';
import { isCoordinateValid } from '@/lib/super-app/location-guard';
import {
  isStorefrontProductInStock,
  selectPublishedStorefrontProducts,
} from '@/lib/super-app/umkm-storefront-products';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

type StoreAction = {
  href: string;
  label: string;
  kind: 'whatsapp' | 'phone' | 'maps' | 'products' | 'information';
  external: boolean;
};

function readMetaText(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function hasMetaKey(
  metadata: Record<string, unknown>,
  ...keys: string[]
): boolean {
  return keys.some(key => Object.prototype.hasOwnProperty.call(metadata, key));
}

function formatIdr(valueCents: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(valueCents / 100)));
}

function readMetaTextArray(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string[] {
  return keys.flatMap(key => {
    const value = metadata[key];
    if (Array.isArray(value)) {
      return value
        .map(item => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean);
    }
    if (typeof value === 'string') {
      return value
        .split(/[,\n]/)
        .map(item => item.trim())
        .filter(Boolean);
    }
    return [];
  });
}

function isPlaceholderImage(image: string): boolean {
  return image.includes('/images/placeholders/');
}

function productImage(product: UmkmProduct): string | null {
  const image =
    product.image_url || readMetaText(product.metadata, 'image_url') || '';
  return image && !isPlaceholderImage(image) ? image : null;
}

function uniqueImages(images: string[]): string[] {
  return Array.from(
    new Set(images.map(image => image.trim()).filter(Boolean)),
  ).slice(0, 3);
}

function getExplicitStoreImages(metadata: Record<string, unknown>): string[] {
  const singularKeys = [
    'store_photo_url',
    'cover_image_url',
    'cover_url',
    'banner_url',
    'image_url',
    'imageUrl',
    'image',
    'menu_photo_url',
  ];

  return uniqueImages(
    [
      ...singularKeys.map(key => readMetaText(metadata, key)),
      ...readMetaTextArray(
        metadata,
        'gallery_images',
        'gallery',
        'images',
        'photos',
      ),
    ].filter(image => !isPlaceholderImage(image)),
  );
}

function resolvePublicContact(
  store: PublicUmkmStore,
  place: ReturnType<typeof buildUmkmPlacePresentation>,
): {
  whatsappHref: string | null;
  telHref: string | null;
  schemaPhone: string | null;
} {
  return {
    whatsappHref: store.phone ? place.whatsappHref : null,
    telHref: store.phone ? place.telHref : null,
    schemaPhone: store.phone,
  };
}

function StorePill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'positive' | 'warning' | 'neutral';
}) {
  const toneClass =
    tone === 'positive'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950/55 dark:text-emerald-200 dark:ring-emerald-800'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950/55 dark:text-amber-200 dark:ring-amber-800'
        : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700';

  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full px-3 text-xs font-bold ring-1 ${toneClass}`}
    >
      {children}
    </span>
  );
}

function ProductCard({
  product,
  isId,
}: {
  product: UmkmProduct;
  isId: boolean;
}) {
  const inStock = isStorefrontProductInStock(product);
  const image = productImage(product);

  return (
    <article
      className="overflow-hidden rounded-[20px] border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
      data-testid="storefront-product-card"
    >
      <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-800">
        {image ? (
          <LajukanImage
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 260px, (min-width: 640px) 44vw, 92vw"
            className="object-cover"
          />
        ) : (
          <div
            role="img"
            aria-label={
              isId
                ? `Belum ada foto untuk ${product.name}`
                : `No photo for ${product.name}`
            }
            className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-slate-400 dark:text-slate-500"
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-700">
              <ImageOff className="h-5 w-5" />
            </span>
            <span className="text-xs font-bold">
              {isId ? 'Belum ada foto' : 'No photo yet'}
            </span>
          </div>
        )}
        {!inStock ? (
          <span className="absolute left-3 top-3 rounded-full bg-slate-950/78 px-2.5 py-1 text-[11px] font-bold text-white">
            {isId ? 'Stok habis' : 'Out of stock'}
          </span>
        ) : null}
      </div>
      <div className="p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
          {product.category || (isId ? 'Produk' : 'Product')}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-bold leading-6 text-slate-950 dark:text-slate-50">
          {product.name}
        </h3>
        {product.description ? (
          <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-500 dark:text-slate-400">
            {product.description}
          </p>
        ) : null}
        <div className="mt-3 flex items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <p className="text-base font-extrabold text-emerald-700 dark:text-emerald-300">
            {formatIdr(product.price_cents)}
          </p>
          {inStock ? (
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isId
                ? `Stok ${product.stock_qty}`
                : `${product.stock_qty} in stock`}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function InfoRow({
  icon,
  label,
  value,
  note,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">
          {value}
        </dd>
        {note ? (
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            {note}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function PrimaryAction({
  action,
  testId,
  className = '',
}: {
  action: StoreAction;
  testId: string;
  className?: string;
}) {
  const Icon =
    action.kind === 'whatsapp'
      ? MessageCircle
      : action.kind === 'phone'
        ? Phone
        : action.kind === 'maps'
          ? MapPin
          : action.kind === 'products'
            ? ShoppingBag
            : PackageCheck;

  return (
    <a
      href={action.href}
      target={action.external ? '_blank' : undefined}
      rel={action.external ? 'noopener noreferrer' : undefined}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-[0_16px_28px_-22px_rgba(4,120,87,0.8)] transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${className}`}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" />
      {action.label}
    </a>
  );
}

async function getStoreProducts(store: UmkmStore): Promise<UmkmProduct[]> {
  try {
    const products = await listUmkmProducts({
      storeId: store.id,
      includeUnavailable: false,
      limit: 8,
    });

    return selectPublishedStorefrontProducts(products);
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const isId = locale === 'id';
  const storedStore = await getUmkmStoreBySlug(slug);

  if (!storedStore || !isPublicUmkmStoreVisible(storedStore)) {
    return {
      title: isId
        ? 'Toko tidak ditemukan | Lajukan'
        : 'Business not found | Lajukan',
    };
  }

  const store = projectPublicUmkmStore(storedStore);
  const baseUrl = await getBaseUrl();
  const publicUrl = `${baseUrl}/${locale}/toko/${store.slug}`;
  const storeMetadata =
    store.metadata && typeof store.metadata === 'object' ? store.metadata : {};
  const seoImage = getExplicitStoreImages(storeMetadata)[0];
  const description =
    store.description ||
    (isId
      ? `${store.name}, UMKM di ${store.city}. Lihat produk dan informasi operasional terbarunya di Lajukan.`
      : `${store.name}, a local business in ${store.city}. See its products and latest operating information on Lajukan.`);

  return {
    title: `${store.name} | Lajukan`,
    description,
    alternates: { canonical: publicUrl },
    openGraph: {
      title: store.name,
      description,
      url: publicUrl,
      type: 'website',
      ...(seoImage ? { images: [seoImage] } : {}),
    },
    twitter: {
      card: seoImage ? 'summary_large_image' : 'summary',
      title: store.name,
      description,
      ...(seoImage ? { images: [seoImage] } : {}),
    },
  };
}

export default async function TokoPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const isId = locale === 'id';
  const storedStore = await getUmkmStoreBySlug(slug);

  if (!storedStore || !isPublicUmkmStoreVisible(storedStore)) {
    notFound();
  }

  const store = projectPublicUmkmStore(storedStore);
  const baseUrl = await getBaseUrl();
  const publicUrl = `${baseUrl}/${locale}/toko/${store.slug}`;
  const metadata =
    store.metadata && typeof store.metadata === 'object' ? store.metadata : {};
  const products = await getStoreProducts(storedStore);
  const availableProductCount = products.filter(
    isStorefrontProductInStock,
  ).length;
  const place = buildUmkmPlacePresentation(store, isId, null);
  const publicContact = resolvePublicContact(store, place);
  const gallery = getExplicitStoreImages(metadata);
  const hasMediaMosaic = gallery.length > 1;

  const hasValidCoordinates = isCoordinateValid({
    lat: store.lat,
    lng: store.lng,
  });
  const hasFixedLocation =
    place.locationMode === 'fixed' && hasValidCoordinates;
  const explicitOpenHours = readMetaText(metadata, 'open_hours');
  const hasScheduleEvidence =
    Boolean(explicitOpenHours) ||
    hasMetaKey(
      metadata,
      'outlet_active',
      'live_now',
      'auto_live_schedule_enabled',
      'live_schedule_days',
      'live_schedule_start',
      'live_schedule_end',
    );
  const statusLabel = hasScheduleEvidence
    ? place.statusLabel
    : isId
      ? 'Status belum diperbarui'
      : 'Status not updated';
  const openHoursLabel = explicitOpenHours
    ? explicitOpenHours
    : hasScheduleEvidence &&
        hasMetaKey(
          metadata,
          'auto_live_schedule_enabled',
          'live_schedule_days',
          'live_schedule_start',
          'live_schedule_end',
        )
      ? place.openHours
      : isId
        ? 'Jam buka belum dicantumkan'
        : 'Opening hours not listed';
  const hasRating = place.ratingCount > 0 && place.ratingNumber > 0;
  const ratingLabel = hasRating
    ? `${place.ratingNumber.toFixed(1)} · ${place.reviewCountLabel} ${
        isId ? 'ulasan' : 'reviews'
      }`
    : '';
  const publicLocationLabel =
    place.locationMode === 'mobile'
      ? store.city ||
        (isId ? 'Area layanan belum dicantumkan' : 'Service area not listed')
      : store.address ||
        store.city ||
        (isId ? 'Alamat belum dicantumkan' : 'Address not listed');
  const locationNote =
    place.locationMode === 'mobile'
      ? isId
        ? 'Usaha ini beroperasi keliling. Titik jual dapat berubah; tanyakan lokasi terbarunya sebelum datang.'
        : 'This business operates on the move. Its selling point may change; confirm the latest location before visiting.'
      : !hasValidCoordinates
        ? isId
          ? 'Titik peta belum tersedia. Gunakan alamat atau kota sebagai acuan.'
          : 'A map point is not available. Use the address or city as a reference.'
        : '';

  const primaryAction: StoreAction = publicContact.whatsappHref
    ? {
        href: publicContact.whatsappHref,
        label: isId ? 'Tanya toko' : 'Ask the business',
        kind: 'whatsapp',
        external: true,
      }
    : publicContact.telHref
      ? {
          href: publicContact.telHref,
          label: isId ? 'Telepon toko' : 'Call the business',
          kind: 'phone',
          external: false,
        }
      : hasFixedLocation
        ? {
            href: place.googleMapsDirectionsUrl,
            label: isId ? 'Lihat lokasi' : 'View location',
            kind: 'maps',
            external: true,
          }
        : products.length > 0
          ? {
              href: '#produk',
              label: isId ? 'Lihat katalog' : 'View catalog',
              kind: 'products',
              external: false,
            }
          : {
              href: '#informasi-usaha',
              label: isId ? 'Lihat informasi' : 'View information',
              kind: 'information',
              external: false,
            };

  const statusTone =
    !hasScheduleEvidence || place.statusTone === 'muted'
      ? 'neutral'
      : place.statusTone === 'positive'
        ? 'positive'
        : 'warning';

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.name,
    description: store.description || undefined,
    url: publicUrl,
    ...(gallery[0] ? { image: gallery[0] } : {}),
    address: {
      '@type': 'PostalAddress',
      ...(place.locationMode === 'fixed' && store.address
        ? { streetAddress: store.address }
        : {}),
      addressLocality: store.city || undefined,
      addressCountry: 'ID',
    },
    openingHours: explicitOpenHours || undefined,
    telephone: publicContact.schemaPhone || undefined,
  };

  if (hasFixedLocation) {
    jsonLd.geo = {
      '@type': 'GeoCoordinates',
      latitude: store.lat,
      longitude: store.lng,
    };
  }
  if (hasRating) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: place.ratingNumber,
      reviewCount: place.ratingCount,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="min-h-screen bg-slate-50 pb-40 pt-3 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pt-5 lg:pb-10">
        <div className="page-shell">
          <nav
            aria-label={isId ? 'Navigasi toko' : 'Business navigation'}
            className="mb-3 flex items-center justify-between gap-3"
          >
            <Link
              href={`/${locale}/umkm`}
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" />
              {isId ? 'Jelajahi UMKM' : 'Explore businesses'}
            </Link>
            <span className="hidden text-xs font-semibold text-slate-500 dark:text-slate-400 sm:inline">
              {isId ? 'Profil usaha publik' : 'Public business profile'}
            </span>
          </nav>

          <section
            className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_50px_-42px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900 sm:rounded-[28px] lg:grid lg:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)]"
            data-testid="storefront-summary"
          >
            <div
              className={
                hasMediaMosaic
                  ? 'grid aspect-[16/10] min-h-[250px] grid-cols-[minmax(0,2fr)_minmax(100px,1fr)] grid-rows-2 gap-1 bg-slate-100 dark:bg-slate-800 sm:min-h-[340px] lg:aspect-auto lg:min-h-[440px]'
                  : 'relative aspect-[16/10] min-h-[250px] overflow-hidden bg-slate-100 dark:bg-slate-800 sm:min-h-[340px] lg:aspect-auto lg:min-h-[440px]'
              }
              data-testid="storefront-media"
              data-media-count={gallery.length}
            >
              {gallery.length > 0 ? (
                hasMediaMosaic ? (
                  <>
                    <div className="relative row-span-2 overflow-hidden bg-slate-200 dark:bg-slate-800">
                      <LajukanImage
                        src={gallery[0]}
                        alt={store.name}
                        fill
                        priority
                        sizes="(min-width: 1024px) 38vw, 67vw"
                        className="object-cover"
                      />
                    </div>
                    {gallery.slice(1, 3).map((image, index) => (
                      <div
                        key={image}
                        className={`relative overflow-hidden bg-slate-200 dark:bg-slate-800 ${
                          gallery.length === 2 ? 'row-span-2' : ''
                        }`}
                      >
                        <LajukanImage
                          src={image}
                          alt={
                            isId
                              ? `Galeri ${store.name} ${index + 2}`
                              : `${store.name} gallery ${index + 2}`
                          }
                          fill
                          sizes="(min-width: 1024px) 18vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    ))}
                  </>
                ) : (
                  <LajukanImage
                    src={gallery[0]}
                    alt={store.name}
                    fill
                    priority
                    sizes="(min-width: 1024px) 55vw, 100vw"
                    className="object-cover"
                  />
                )
              ) : (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_48%),linear-gradient(145deg,#f8fafc,#eef2f7)] px-6 text-center dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.12),_transparent_48%),linear-gradient(145deg,#0f172a,#111827)]"
                  data-testid="storefront-media-placeholder"
                  role="img"
                  aria-label={
                    isId
                      ? `Foto usaha ${store.name} belum tersedia`
                      : `No business photo available for ${store.name}`
                  }
                >
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-[22px] bg-white text-slate-400 ring-1 ring-slate-200 shadow-sm dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-700">
                    <ImageOff className="h-7 w-7" />
                  </span>
                  <p className="mt-4 text-base font-extrabold text-slate-700 dark:text-slate-200">
                    {isId
                      ? 'Foto usaha belum tersedia'
                      : 'Business photo not available'}
                  </p>
                  <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {isId
                      ? 'Gunakan nama, kategori, dan alamat di samping untuk memastikan usaha yang Anda cari.'
                      : 'Use the name, category, and address beside this panel to confirm the business.'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-col p-4 sm:p-6 lg:p-7">
              <div className="flex flex-wrap gap-2">
                <StorePill>{place.categoryLabel}</StorePill>
                <StorePill tone={statusTone}>{statusLabel}</StorePill>
              </div>
              <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-[-0.035em] text-slate-950 dark:text-slate-50 sm:text-4xl">
                {store.name}
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                {store.description ||
                  (isId
                    ? `UMKM di ${store.city}. Cek produk dan informasi operasional sebelum berkunjung atau memesan.`
                    : `A local business in ${store.city}. Check products and operating information before visiting or ordering.`)}
              </p>

              <dl className="mt-5 divide-y divide-slate-100 border-y border-slate-100 dark:divide-slate-800 dark:border-slate-800">
                <InfoRow
                  icon={<MapPin className="h-4 w-4" />}
                  label={isId ? 'Area usaha' : 'Business area'}
                  value={publicLocationLabel}
                  note={locationNote || undefined}
                />
                <InfoRow
                  icon={<Clock3 className="h-4 w-4" />}
                  label={isId ? 'Jam operasional' : 'Opening hours'}
                  value={openHoursLabel}
                />
                {hasRating ? (
                  <InfoRow
                    icon={<Star className="h-4 w-4" />}
                    label={isId ? 'Ulasan pelanggan' : 'Customer reviews'}
                    value={ratingLabel}
                  />
                ) : null}
              </dl>

              {place.serviceBadges.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {place.serviceBadges.map(badge => (
                    <span
                      key={badge}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}

              <PrimaryAction
                action={primaryAction}
                testId="storefront-primary-action-desktop"
                className="mt-auto hidden lg:inline-flex"
              />
            </div>
          </section>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <section
              id="produk"
              className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
              data-testid="storefront-products"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                    {isId ? 'Katalog' : 'Catalog'}
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-slate-950 dark:text-slate-50 sm:text-2xl">
                    {isId
                      ? 'Produk dari toko ini'
                      : 'Products from this business'}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {isId
                      ? 'Harga dan stok mengikuti informasi terakhir dari pemilik toko.'
                      : 'Prices and stock reflect the latest information from the owner.'}
                  </p>
                </div>
                <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
                  {availableProductCount} {isId ? 'tersedia' : 'available'}
                </span>
              </div>

              {products.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isId={isId}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center dark:border-slate-700 dark:bg-slate-950/55">
                  <ShoppingBag className="mx-auto h-7 w-7 text-slate-400" />
                  <p className="mt-3 font-bold text-slate-800 dark:text-slate-200">
                    {isId
                      ? 'Produk belum ditampilkan'
                      : 'Products are not listed yet'}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {publicContact.whatsappHref
                      ? isId
                        ? 'Gunakan tombol tanya toko untuk meminta katalog atau stok terbaru.'
                        : 'Use the business contact button to ask for the latest catalog or stock.'
                      : isId
                        ? 'Pemilik toko belum mempublikasikan katalog dan kanal kontak.'
                        : 'The owner has not published a catalog or contact channel.'}
                  </p>
                </div>
              )}
            </section>

            <aside className="space-y-3 lg:sticky lg:top-20">
              <section
                id="informasi-usaha"
                className="scroll-mt-24 rounded-[24px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5"
              >
                <h2 className="text-lg font-extrabold text-slate-950 dark:text-slate-50">
                  {isId ? 'Informasi usaha' : 'Business information'}
                </h2>
                <dl className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                  <InfoRow
                    icon={<MapPin className="h-4 w-4" />}
                    label={isId ? 'Lokasi' : 'Location'}
                    value={publicLocationLabel}
                    note={locationNote || undefined}
                  />
                  <InfoRow
                    icon={<Clock3 className="h-4 w-4" />}
                    label={isId ? 'Jam buka' : 'Opening hours'}
                    value={openHoursLabel}
                  />
                  <InfoRow
                    icon={<PackageCheck className="h-4 w-4" />}
                    label={isId ? 'Layanan' : 'Services'}
                    value={
                      place.serviceBadges.length > 0
                        ? place.serviceBadges.join(' · ')
                        : isId
                          ? 'Belum dicantumkan'
                          : 'Not listed'
                    }
                  />
                </dl>

                {hasFixedLocation && primaryAction.kind !== 'maps' ? (
                  <a
                    href={place.googleMapsDirectionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {isId ? 'Buka rute di Maps' : 'Open route in Maps'}
                  </a>
                ) : null}
              </section>

              <section className="rounded-[24px] border border-emerald-100 bg-emerald-50 p-4 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/35 dark:text-emerald-100">
                <p className="text-sm font-extrabold">
                  {isId ? 'Sebelum transaksi' : 'Before transacting'}
                </p>
                <p className="mt-2 text-sm leading-6 text-emerald-900/80 dark:text-emerald-100/80">
                  {isId
                    ? 'Konfirmasi stok, harga, lokasi, dan cara pengiriman. Jangan kirim data pribadi atau pembayaran sebelum informasinya jelas.'
                    : 'Confirm stock, price, location, and delivery. Do not send personal data or payment before the details are clear.'}
                </p>
              </section>
            </aside>
          </div>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 px-3 lg:hidden">
        <div className="mx-auto max-w-md rounded-[20px] border border-slate-200 bg-white/96 p-2 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-900/96">
          <PrimaryAction
            action={primaryAction}
            testId="storefront-primary-action-mobile"
            className="w-full"
          />
        </div>
      </div>
    </>
  );
}
