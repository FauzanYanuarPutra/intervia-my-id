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
      className={`inline-flex min-h-6 items-center rounded-full px-2 text-[10px] font-bold ring-1 sm:text-[11px] ${toneClass}`}
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
      className="group py-3 first:pt-0 last:pb-0"
      data-testid="storefront-product-card"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h4 className="line-clamp-2 text-sm font-extrabold leading-5 text-slate-950 dark:text-slate-50 sm:text-[15px]">
            {product.name}
          </h4>

          {product.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
              {product.description}
            </p>
          ) : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-sm font-extrabold text-slate-950 dark:text-slate-100 sm:text-[15px]">
              {formatIdr(product.price_cents)}
            </p>
            <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {inStock
                ? isId
                  ? `${product.stock_qty} tersedia`
                  : `${product.stock_qty} available`
                : stockStatus === 'unknown'
                  ? isId
                    ? 'Cek stok'
                    : 'Check stock'
                  : isId
                    ? 'Habis'
                    : 'Out of stock'}
            </span>
          </div>

          <div className="mt-2">
            <StorefrontProductOrderAction
              storeId={product.store_id}
              productId={product.id}
              productName={product.name}
              onlineOrderEnabled={onlineOrderEnabled}
              productAvailable={
                product.is_available && stockStatus !== 'out_of_stock'
              }
              isId={isId}
              variant="compact"
            />
          </div>
        </div>

        <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:ring-slate-700 sm:h-24 sm:w-24">
          {image ? (
            <LajukanImage
              src={image}
              alt={product.name}
              fill
              sizes="96px"
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
              className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center text-slate-400 dark:text-slate-500"
            >
              <ImageOff className="h-4 w-4" />
              <span className="text-[9px] font-bold">
                {isId ? 'Belum ada foto' : 'No photo'}
              </span>
            </div>
          )}
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
    <div className="flex items-start gap-2.5 py-2.5">
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {icon}
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
          {label}
        </dt>
        <dd className="mt-0.5 text-sm font-bold leading-5 text-slate-900 dark:text-slate-100">
          {value}
        </dd>
        {note ? (
          <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
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
      className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${className}`}
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
              label: isId ? 'Lihat menu' : 'View menu',
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

  const fallbackCategory = isId ? 'Menu lainnya' : 'Other items';
  const menuGroups = Array.from(
    products.reduce<Map<string, UmkmProduct[]>>((groups, product) => {
      const label = product.category?.trim() || fallbackCategory;
      const existing = groups.get(label);
      if (existing) existing.push(product);
      else groups.set(label, [product]);
      return groups;
    }, new Map()),
  ).map(([label, items], index) => ({
    id: `menu-category-${index + 1}`,
    label,
    items,
  }));

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
      <main
        data-layout="compact-food-storefront"
        className="min-h-screen bg-slate-50 pb-8 pt-2 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pt-4"
      >
        <div className="page-shell">
          <nav
            aria-label={isId ? 'Navigasi toko' : 'Business navigation'}
            className="mb-2 flex items-center justify-between gap-2"
          >
            <Link
              href={`/${locale}/umkm`}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-xl bg-white px-2.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-200 dark:ring-slate-800 dark:hover:bg-slate-800 sm:text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              {isId ? 'UMKM' : 'Businesses'}
            </Link>
            <span className="hidden text-xs font-semibold text-slate-400 sm:inline">
              {isId ? 'Toko di Lajukan' : 'Business on Lajukan'}
            </span>
          </nav>

          <section
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            data-testid="storefront-summary"
          >
            <div
              className="relative h-24 overflow-hidden bg-slate-100 dark:bg-slate-800 sm:h-32 lg:h-36"
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
                  className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,_rgba(16,185,129,0.24),_transparent_38%),radial-gradient(circle_at_82%_24%,_rgba(14,165,233,0.15),_transparent_34%),linear-gradient(135deg,#ecfdf5,#f8fafc_55%,#eff6ff)] dark:bg-[radial-gradient(circle_at_18%_18%,_rgba(16,185,129,0.18),_transparent_38%),radial-gradient(circle_at_82%_24%,_rgba(14,165,233,0.12),_transparent_34%),linear-gradient(135deg,#052e2b,#0f172a_55%,#172554)]"
                  data-testid="storefront-media-placeholder"
                  role="img"
                  aria-label={
                    isId
                      ? `Banner ${store.name} belum tersedia`
                      : `No cover for ${store.name}`
                  }
                />
              )}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-slate-950/5" />
            </div>

            <div className="relative px-3 pb-3 sm:px-4 sm:pb-4">
              <div className="flex items-start gap-3">
                <div className="relative -mt-6 h-16 w-16 shrink-0 overflow-hidden rounded-xl border-[3px] border-white bg-white shadow-sm dark:border-slate-900 dark:bg-slate-900 sm:-mt-7 sm:h-20 sm:w-20">
                  {brandMedia.logoUrl ? (
                    <LajukanImage
                      src={brandMedia.logoUrl}
                      alt={isId ? `Logo ${store.name}` : `${store.name} logo`}
                      fill
                      sizes="80px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-200">
                      <Store className="h-6 w-6 sm:h-7 sm:w-7" />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 pt-2.5 sm:pt-3">
                  <h1 className="line-clamp-2 text-lg font-extrabold leading-tight tracking-[-0.02em] text-slate-950 dark:text-slate-50 sm:text-2xl">
                    {store.name}
                  </h1>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <StorePill>{place.categoryLabel}</StorePill>
                    <StorePill tone={statusTone}>{statusLabel}</StorePill>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{publicLocationLabel}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{openHoursLabel}</span>
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5 sm:col-span-2 lg:col-span-1">
                  {hasRating ? (
                    <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
                  ) : (
                    <PackageCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  )}
                  <span className="truncate">
                    {hasRating
                      ? ratingLabel
                      : `${availableProductCount} ${isId ? 'menu tersedia' : 'items available'}`}
                  </span>
                </span>
              </div>

              {store.description ? (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">
                  {store.description}
                </p>
              ) : null}

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {place.serviceBadges.length > 0 ? (
                  <div className="flex min-w-0 flex-wrap gap-1.5">
                    {place.serviceBadges.slice(0, 3).map(badge => (
                      <span
                        key={badge}
                        className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"
                      >
                        {badge}
                      </span>
                    ))}
                    {place.serviceBadges.length > 3 ? (
                      <span className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700">
                        +{place.serviceBadges.length - 3}
                      </span>
                    ) : null}
                  </div>
                ) : (
                  <span />
                )}

                <PrimaryAction
                  action={primaryAction}
                  testId="storefront-primary-action"
                  className="w-full shrink-0 sm:w-auto"
                />
              </div>
            </div>
          </section>

          <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <section
              id="produk"
              className="scroll-mt-20 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              data-testid="storefront-products"
            >
              <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800 sm:px-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold tracking-[-0.02em] text-slate-950 dark:text-slate-50 sm:text-xl">
                    {isId ? 'Menu' : 'Menu'}
                  </h2>
                  <span className="shrink-0 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {availableProductCount} {isId ? 'tersedia' : 'available'}
                  </span>
                </div>

                {menuGroups.length > 1 ? (
                  <nav
                    aria-label={isId ? 'Kategori menu' : 'Menu categories'}
                    className="-mx-0.5 mt-2 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {menuGroups.map(group => (
                      <a
                        key={group.id}
                        href={`#${group.id}`}
                        className="inline-flex min-h-7 shrink-0 items-center rounded-full bg-slate-100 px-2.5 text-[11px] font-bold text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-200"
                      >
                        {group.label}
                      </a>
                    ))}
                  </nav>
                ) : null}
              </div>

              {catalog.status === 'unavailable' ? (
                <div
                  className="m-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-6 text-center dark:border-amber-900/70 dark:bg-amber-950/30"
                  role="status"
                >
                  <ShoppingBag className="mx-auto h-6 w-6 text-amber-600 dark:text-amber-300" />
                  <p className="mt-2 text-sm font-bold text-amber-950 dark:text-amber-100">
                    {isId
                      ? 'Menu belum bisa dimuat'
                      : 'The menu could not be loaded'}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-amber-800 dark:text-amber-200/80">
                    {isId
                      ? 'Informasi toko tetap tersedia. Coba muat ulang.'
                      : 'Business information is still available. Try again.'}
                  </p>
                  <Link
                    href={`/${locale}/toko/${encodeURIComponent(store.slug)}`}
                    className="mt-3 inline-flex min-h-9 items-center justify-center rounded-xl border border-amber-300 bg-white px-3 text-sm font-bold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100 dark:hover:bg-amber-900/50"
                  >
                    {isId ? 'Coba lagi' : 'Try again'}
                  </Link>
                </div>
              ) : menuGroups.length > 0 ? (
                <div className="px-3 pb-1 sm:px-4">
                  {menuGroups.map(group => (
                    <section
                      id={group.id}
                      key={group.id}
                      data-testid="storefront-menu-group"
                      className="scroll-mt-20 border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-sm font-extrabold text-slate-950 dark:text-slate-50 sm:text-base">
                          {group.label}
                        </h3>
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                          {group.items.length} {isId ? 'item' : 'items'}
                        </span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {group.items.map(product => (
                          <ProductCard
                            key={product.id}
                            product={product}
                            isId={isId}
                            onlineOrderEnabled={store.online_order_enabled}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="m-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center dark:border-slate-700 dark:bg-slate-950/55">
                  <ShoppingBag className="mx-auto h-6 w-6 text-slate-400" />
                  <p className="mt-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                    {isId ? 'Menu belum ditampilkan' : 'Menu is not listed yet'}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {publicContact.whatsappHref
                      ? isId
                        ? 'Tanya toko untuk menu atau stok terbaru.'
                        : 'Ask the business for the latest menu or stock.'
                      : isId
                        ? 'Menu dan kanal kontak belum dipublikasikan.'
                        : 'The menu and contact channel are not published yet.'}
                  </p>
                </div>
              )}
            </section>

            <aside className="space-y-3 lg:sticky lg:top-20">
              <section
                id="informasi-usaha"
                className="scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-extrabold text-slate-950 dark:text-slate-50">
                    {isId ? 'Info toko' : 'Business info'}
                  </h2>
                  <span className="text-[10px] font-semibold text-slate-400 lg:hidden">
                    {isId ? 'Detail' : 'Details'}
                  </span>
                </div>

                <dl className="mt-0.5 divide-y divide-slate-100 dark:divide-slate-800">
                  <InfoRow
                    icon={<MapPin className="h-3.5 w-3.5" />}
                    label={isId ? 'Lokasi' : 'Location'}
                    value={publicLocationLabel}
                    note={locationNote || undefined}
                  />
                  <InfoRow
                    icon={<Clock3 className="h-3.5 w-3.5" />}
                    label={isId ? 'Jam buka' : 'Opening hours'}
                    value={openHoursLabel}
                  />
                  <InfoRow
                    icon={<PackageCheck className="h-3.5 w-3.5" />}
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
                    className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {isId ? 'Buka Maps' : 'Open Maps'}
                  </a>
                ) : null}

                <p className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-[11px] leading-4 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-100/80">
                  {isId
                    ? 'Konfirmasi stok, harga, lokasi, dan pengiriman sebelum membayar.'
                    : 'Confirm stock, price, location, and delivery before paying.'}
                </p>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}