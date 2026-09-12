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
  Store,
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
  getStorefrontProductStockStatus,
  isStorefrontProductInStock,
  loadStorefrontCatalog,
} from '@/lib/super-app/umkm-storefront-products';
import { serializeJsonLd } from '@/lib/seo/jsonLd';
import { StorefrontProductOrderAction } from './StorefrontProductOrderAction';
import { resolveStorefrontBrandMedia } from '@/lib/super-app/storefront-brand-media';

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

function isPlaceholderImage(image: string): boolean {
  return image.includes('/images/placeholders/');
}

function productImage(product: UmkmProduct): string | null {
  const image =
    product.image_url || readMetaText(product.metadata, 'image_url') || '';
  return image && !isPlaceholderImage(image) ? image : null;
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
  onlineOrderEnabled,
}: {
  product: UmkmProduct;
  isId: boolean;
  onlineOrderEnabled: boolean;
}) {
  const stockStatus = getStorefrontProductStockStatus(product);
  const inStock = stockStatus === 'in_stock';
  const image = productImage(product);

  return (
    <article
      className="group overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_16px_38px_-34px_rgba(15,23,42,0.55)] transition duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_22px_46px_-32px_rgba(5,150,105,0.35)] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-900"
      data-testid="storefront-product-card"
    >
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-800">
        {image ? (
          <LajukanImage
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 1280px) 260px, (min-width: 640px) 44vw, 92vw"
            className="object-cover transition duration-300 group-hover:scale-[1.025]"
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
        {stockStatus !== 'in_stock' ? (
          <span className="absolute left-3 top-3 rounded-full bg-slate-950/78 px-2.5 py-1 text-[11px] font-bold text-white">
            {stockStatus === 'unknown'
              ? isId
                ? 'Stok perlu dikonfirmasi'
                : 'Stock needs confirmation'
              : isId
                ? 'Stok habis'
                : 'Out of stock'}
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
        <StorefrontProductOrderAction
          storeId={product.store_id}
          productId={product.id}
          productName={product.name}
          onlineOrderEnabled={onlineOrderEnabled}
          productAvailable={
            product.is_available && stockStatus !== 'out_of_stock'
          }
          isId={isId}
        />
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

async function getStoreProducts(store: UmkmStore) {
  return loadStorefrontCatalog(
    () =>
      listUmkmProducts({
        storeId: store.id,
        includeUnavailable: false,
        limit: 8,
      }),
    8,
  );
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
  const seoImage = resolveStorefrontBrandMedia(storeMetadata).seoImageUrl;
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
  const catalog = await getStoreProducts(storedStore);
  const products = catalog.products;
  const availableProductCount = products.filter(
    isStorefrontProductInStock,
  ).length;
  const place = buildUmkmPlacePresentation(store, isId, null);
  const publicContact = resolvePublicContact(store, place);
  const brandMedia = resolveStorefrontBrandMedia(metadata);

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
    ...(brandMedia.seoImageUrl ? { image: brandMedia.seoImageUrl } : {}),
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
            className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_28px_70px_-48px_rgba(15,23,42,0.5)] dark:border-slate-800 dark:bg-slate-900 sm:rounded-[30px]"
            data-testid="storefront-summary"
          >
            <div
              className="relative aspect-[8/3] min-h-[190px] max-h-[410px] overflow-hidden bg-slate-100 dark:bg-slate-800 sm:min-h-[260px]"
              data-testid="storefront-media"
              data-media-count={
                Number(Boolean(brandMedia.coverUrl)) +
                Number(Boolean(brandMedia.logoUrl)) +
                brandMedia.galleryUrls.length
              }
            >
              {brandMedia.coverUrl ? (
                <LajukanImage
                  src={brandMedia.coverUrl}
                  alt={isId ? `Banner ${store.name}` : `${store.name} cover`}
                  fill
                  priority
                  sizes="(min-width: 1280px) 1200px, 100vw"
                  className="object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,_rgba(16,185,129,0.28),_transparent_35%),radial-gradient(circle_at_82%_24%,_rgba(14,165,233,0.18),_transparent_32%),linear-gradient(135deg,#ecfdf5,#f8fafc_55%,#eff6ff)] dark:bg-[radial-gradient(circle_at_18%_18%,_rgba(16,185,129,0.2),_transparent_35%),radial-gradient(circle_at_82%_24%,_rgba(14,165,233,0.14),_transparent_32%),linear-gradient(135deg,#052e2b,#0f172a_55%,#172554)]"
                  data-testid="storefront-media-placeholder"
                  role="img"
                  aria-label={isId ? `Banner ${store.name} belum tersedia` : `No cover for ${store.name}`}
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-slate-950/10" />
              <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-6">
                <StorePill>{place.categoryLabel}</StorePill>
                <StorePill tone={statusTone}>{statusLabel}</StorePill>
              </div>
            </div>

            <div className="relative px-4 pb-5 sm:px-7 sm:pb-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div className="flex min-w-0 items-end gap-4 sm:gap-5">
                  <div className="relative -mt-12 h-24 w-24 shrink-0 overflow-hidden rounded-[24px] border-4 border-white bg-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.6)] dark:border-slate-900 dark:bg-slate-900 sm:-mt-16 sm:h-32 sm:w-32 sm:rounded-[30px]">
                    {brandMedia.logoUrl ? (
                      <LajukanImage
                        src={brandMedia.logoUrl}
                        alt={isId ? `Logo ${store.name}` : `${store.name} logo`}
                        fill
                        sizes="128px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200">
                        <Store className="h-9 w-9 sm:h-11 sm:w-11" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 pb-1 pt-4 sm:pt-5">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                      {isId ? 'Toko di Lajukan' : 'Business on Lajukan'}
                    </p>
                    <h1 className="mt-1 line-clamp-2 text-2xl font-extrabold leading-tight tracking-[-0.035em] text-slate-950 dark:text-slate-50 sm:text-4xl">
                      {store.name}
                    </h1>
                  </div>
                </div>
                <PrimaryAction
                  action={primaryAction}
                  testId="storefront-primary-action-desktop"
                  className="hidden shrink-0 lg:inline-flex"
                />
              </div>

              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
                {store.description ||
                  (isId
                    ? `UMKM di ${store.city}. Cek produk dan informasi operasional sebelum berkunjung atau memesan.`
                    : `A local business in ${store.city}. Check products and operating information before visiting or ordering.`)}
              </p>

              <dl className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 px-3.5 dark:bg-slate-800/65">
                  <InfoRow
                    icon={<MapPin className="h-4 w-4" />}
                    label={isId ? 'Area usaha' : 'Business area'}
                    value={publicLocationLabel}
                    note={locationNote || undefined}
                  />
                </div>
                <div className="rounded-2xl bg-slate-50 px-3.5 dark:bg-slate-800/65">
                  <InfoRow
                    icon={<Clock3 className="h-4 w-4" />}
                    label={isId ? 'Jam operasional' : 'Opening hours'}
                    value={openHoursLabel}
                  />
                </div>
                <div className="rounded-2xl bg-slate-50 px-3.5 dark:bg-slate-800/65">
                  <InfoRow
                    icon={hasRating ? <Star className="h-4 w-4" /> : <PackageCheck className="h-4 w-4" />}
                    label={hasRating ? (isId ? 'Ulasan pelanggan' : 'Customer reviews') : (isId ? 'Produk tersedia' : 'Available products')}
                    value={hasRating ? ratingLabel : `${availableProductCount} ${isId ? 'produk' : 'products'}`}
                  />
                </div>
              </dl>

              {place.serviceBadges.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {place.serviceBadges.map(badge => (
                    <span
                      key={badge}
                      className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100 dark:bg-emerald-950/55 dark:text-emerald-200 dark:ring-emerald-900"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
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

              {catalog.status === 'unavailable' ? (
                <div
                  className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-8 text-center dark:border-amber-900/70 dark:bg-amber-950/30"
                  role="status"
                >
                  <ShoppingBag className="mx-auto h-7 w-7 text-amber-600 dark:text-amber-300" />
                  <p className="mt-3 font-bold text-amber-950 dark:text-amber-100">
                    {isId
                      ? 'Katalog belum bisa dimuat'
                      : 'The catalog could not be loaded'}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-amber-800 dark:text-amber-200/80">
                    {isId
                      ? 'Informasi usaha tetap bisa dilihat. Coba muat ulang katalog dalam beberapa saat.'
                      : 'The business profile is still available. Try loading the catalog again shortly.'}
                  </p>
                  <Link
                    href={`/${locale}/toko/${encodeURIComponent(store.slug)}`}
                    className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 text-sm font-bold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/50"
                  >
                    {isId ? 'Coba lagi' : 'Try again'}
                  </Link>
                </div>
              ) : products.length > 0 ? (
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {products.map(product => (
                    <ProductCard
                      key={product.id}
                      product={product}
                      isId={isId}
                      onlineOrderEnabled={store.online_order_enabled}
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
