import type { Metadata } from 'next';
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
import { ReportBusinessButton } from '@/components/umkm/ReportBusinessButton';

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

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: 'positive' | 'warning' | 'neutral';
}) {
  const toneClass =
    tone === 'positive'
      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/55 dark:text-amber-200'
        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-full px-2.5 text-xs font-semibold ${toneClass}`}
    >
      {label}
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
  const image = productImage(product);
  const available = product.is_available && stockStatus !== 'out_of_stock';

  const stockLabel =
    stockStatus === 'in_stock'
      ? isId
        ? 'Tersedia'
        : 'Available'
      : stockStatus === 'unknown'
        ? isId
          ? 'Cek stok'
          : 'Check stock'
        : isId
          ? 'Habis'
          : 'Sold out';

  return (
    <article
      className="group flex min-w-0 gap-3 border-b border-slate-100 py-3.5 last:border-b-0 dark:border-slate-800 sm:gap-4 sm:py-4 md:min-h-[132px] md:last:border-b"
      data-testid="storefront-product-card"
    >
      <div className="relative h-[84px] w-[84px] shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800 sm:h-24 sm:w-24 md:h-[104px] md:w-[104px] md:rounded-2xl">
        {image ? (
          <LajukanImage
            src={image}
            alt={product.name}
            fill
            sizes="(min-width: 768px) 104px, (min-width: 640px) 96px, 84px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
          />
        ) : (
          <div
            role="img"
            aria-label={
              isId
                ? `Belum ada foto untuk ${product.name}`
                : `No photo for ${product.name}`
            }
            className="absolute inset-0 grid place-items-center text-slate-300 dark:text-slate-600"
          >
            <ImageOff className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-[15px] font-bold leading-5 text-slate-950 dark:text-slate-50">
          {product.name}
        </h4>

        {product.description ? (
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
            {product.description}
          </p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[15px] font-bold tabular-nums text-slate-950 dark:text-slate-100">
            {formatIdr(product.price_cents)}
          </span>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium ${
              stockStatus === 'in_stock'
                ? 'text-emerald-600 dark:text-emerald-300'
                : stockStatus === 'unknown'
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-slate-400 dark:text-slate-500'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {stockLabel}
          </span>
        </div>

        <div className="mt-2">
          <StorefrontProductOrderAction
            storeId={product.store_id}
            productId={product.id}
            productName={product.name}
            onlineOrderEnabled={onlineOrderEnabled}
            productAvailable={available}
            isId={isId}
            variant="compact"
          />
        </div>
      </div>
    </article>
  );
}

function PrimaryAction({
  action,
  testId,
  compact = false,
}: {
  action: StoreAction;
  testId: string;
  compact?: boolean;
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
      className={`inline-flex items-center justify-center gap-1.5 rounded-full bg-emerald-600 font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 ${
        compact ? 'min-h-10 px-3 text-sm' : 'min-h-11 px-4 text-sm'
      }`}
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
  const explicitOpenHours = readMetaText(metadata, 'open_hours', 'schedule');
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
        label: isId ? 'Chat' : 'Chat',
        kind: 'whatsapp',
        external: true,
      }
    : publicContact.telHref
      ? {
          href: publicContact.telHref,
          label: isId ? 'Telepon' : 'Call',
          kind: 'phone',
          external: false,
        }
      : hasFixedLocation
        ? {
            href: place.googleMapsDirectionsUrl,
            label: isId ? 'Maps' : 'Maps',
            kind: 'maps',
            external: true,
          }
        : products.length > 0
          ? {
              href: '#produk',
              label: isId ? 'Menu' : 'Menu',
              kind: 'products',
              external: false,
            }
          : {
              href: '#informasi-usaha',
              label: isId ? 'Info' : 'Info',
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
        className="min-h-screen bg-white pb-8 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:bg-slate-50 sm:py-4 sm:dark:bg-slate-950 lg:py-6"
      >
        <div className="mx-auto w-full max-w-[960px] sm:px-4 lg:px-5">

          <section
            className="relative overflow-hidden bg-white dark:bg-slate-900 sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm sm:dark:border-slate-800"
            data-testid="storefront-summary"
          >
            <Link
              href={`/${locale}/umkm`}
              aria-label={isId ? 'Kembali' : 'Back'}
              className="absolute left-3 top-3 z-20 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-900 shadow-sm ring-1 ring-black/5 backdrop-blur transition hover:scale-[1.03] hover:bg-white dark:bg-slate-900/95 dark:text-slate-100 dark:ring-white/10 sm:left-4 sm:top-4"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            {brandMedia.coverUrl ? (
              <div
                className="relative aspect-[8/3] overflow-hidden bg-slate-100 dark:bg-slate-800"
                data-testid="storefront-media"
                data-media-count={
                  Number(Boolean(brandMedia.coverUrl)) +
                  Number(Boolean(brandMedia.logoUrl)) +
                  brandMedia.galleryUrls.length
                }
              >
                <LajukanImage
                  src={brandMedia.coverUrl}
                  alt={isId ? `Banner ${store.name}` : `${store.name} cover`}
                  fill
                  priority
                  sizes="(min-width: 960px) 960px, 100vw"
                  className="object-cover"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/15 to-transparent" />
              </div>
            ) : null}

            <div
              className={`px-4 pb-4 sm:px-5 sm:pb-5 md:px-6 ${
                brandMedia.coverUrl ? 'pt-0' : 'pt-14 sm:pt-16'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700 sm:h-[72px] sm:w-[72px] md:h-20 md:w-20 ${
                    brandMedia.coverUrl ? '-mt-7 sm:-mt-8' : ''
                  }`}
                >
                  {brandMedia.logoUrl ? (
                    <LajukanImage
                      src={brandMedia.logoUrl}
                      alt={isId ? `Logo ${store.name}` : `${store.name} logo`}
                      fill
                      sizes="(min-width: 768px) 80px, (min-width: 640px) 72px, 64px"
                      className="object-contain p-1"
                    />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300">
                      <Store className="h-7 w-7" />
                    </div>
                  )}
                </div>

                <div
                  className={`min-w-0 flex-1 ${brandMedia.coverUrl ? 'pt-2' : ''}`}
                >
                  <h1 className="line-clamp-2 text-2xl font-bold leading-[30px] text-slate-950 dark:text-slate-50 sm:text-[28px] sm:leading-[34px]">
                    {store.name}
                  </h1>
                  <p className="mt-0.5 text-[13px] font-medium leading-[18px] text-slate-500 dark:text-slate-400">
                    {place.categoryLabel}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <StatusChip label={statusLabel} tone={statusTone} />
                {hasRating ? (
                  <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    {place.ratingNumber.toFixed(1)}
                  </span>
                ) : null}
                <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-slate-100 px-2.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <Clock3 className="h-3.5 w-3.5" />
                  <span className="max-w-[170px] truncate">{openHoursLabel}</span>
                </span>
              </div>

              <div className="mt-3 flex min-w-0 items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-500 dark:text-slate-400 sm:text-[13px]">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="truncate">{publicLocationLabel}</span>
                  {hasFixedLocation && primaryAction.kind !== 'maps' ? (
                    <a
                      href={place.googleMapsDirectionsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-300"
                    >
                      Maps
                    </a>
                  ) : null}
                </div>

                <PrimaryAction
                  action={primaryAction}
                  testId="storefront-primary-action"
                  compact
                />
              </div>
            </div>
          </section>

          <section
            id="produk"
            className="mt-1.5 bg-white dark:bg-slate-900 sm:mt-3 sm:overflow-hidden sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-sm sm:dark:border-slate-800"
            data-testid="storefront-products"
          >
            <div className="sticky top-0 z-30 border-y border-slate-100 bg-white/95 px-4 py-2.5 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 sm:rounded-t-3xl sm:border-t-0 sm:px-5 md:px-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold leading-7 text-slate-950 dark:text-slate-50">
                  {isId ? 'Menu' : 'Menu'}
                </h2>
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">
                  {products.length} {isId ? 'item' : 'items'}
                </span>
              </div>

              {menuGroups.length > 1 ? (
                <nav
                  aria-label={isId ? 'Kategori menu' : 'Menu categories'}
                  className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  <a
                    href="#menu-all"
                    className="inline-flex min-h-8 shrink-0 snap-start items-center rounded-full bg-emerald-600 px-3 text-xs font-semibold text-white"
                  >
                    {isId ? 'Semua' : 'All'}
                  </a>
                  {menuGroups.map(group => (
                    <a
                      key={group.id}
                      href={`#${group.id}`}
                      className="inline-flex h-8 shrink-0 snap-start items-center rounded-full bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      {group.label}
                    </a>
                  ))}
                </nav>
              ) : null}
            </div>

            <div id="menu-all" className="scroll-mt-24">
              {catalog.status === 'unavailable' ? (
                <div className="px-4 py-12 text-center" role="status">
                  <ShoppingBag className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-sm font-semibold">
                    {isId ? 'Menu belum bisa dimuat' : 'Menu unavailable'}
                  </p>
                  <Link
                    href={`/${locale}/toko/${encodeURIComponent(store.slug)}`}
                    className="mt-3 inline-flex min-h-10 items-center rounded-full bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {isId ? 'Coba lagi' : 'Try again'}
                  </Link>
                </div>
              ) : menuGroups.length > 0 ? (
                <div>
                  {menuGroups.map((group, groupIndex) => (
                    <section
                      id={group.id}
                      key={group.id}
                      data-testid="storefront-menu-group"
                      className="scroll-mt-24"
                    >
                      <div
                        className={`${
                          groupIndex > 0
                            ? 'border-t-[7px] border-slate-50 dark:border-slate-950'
                            : ''
                        } px-4 pb-1 pt-4 sm:px-5 md:px-6`}
                      >
                        <h3 className="text-base font-bold leading-[22px] text-slate-950 dark:text-slate-50">
                          {group.label}
                        </h3>
                      </div>

                      <div className="px-4 sm:px-5 md:grid md:grid-cols-2 md:gap-x-6 md:px-6">
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
                <div className="px-4 py-12 text-center">
                  <ShoppingBag className="mx-auto h-7 w-7 text-slate-300 dark:text-slate-600" />
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {isId ? 'Belum ada menu' : 'No menu yet'}
                  </p>
                  {publicContact.whatsappHref ? (
                    <a
                      href={publicContact.whatsappHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {isId ? 'Tanya toko' : 'Ask store'}
                    </a>
                  ) : null}
                </div>
              )}
            </div>
          </section>

          <details
            id="informasi-usaha"
            className="group mt-1.5 border-y border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900 sm:mt-3 sm:rounded-2xl sm:border sm:shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold marker:content-none sm:px-5 md:px-6 [&::-webkit-details-marker]:hidden">
              <span>{isId ? 'Info toko' : 'Store info'}</span>
              <span className="text-lg font-normal text-slate-400 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>

            <div className="border-t border-slate-100 px-4 py-3 text-sm dark:border-slate-800 sm:px-5 md:px-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-slate-100">
                      {publicLocationLabel}
                    </p>
                    {locationNote ? (
                      <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {locationNote}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex gap-2.5">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <p className="font-bold text-slate-900 dark:text-slate-100">
                    {openHoursLabel}
                  </p>
                </div>

                {place.serviceBadges.length > 0 ? (
                  <div className="flex gap-2.5 sm:col-span-2">
                    <PackageCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
                      {place.serviceBadges.join(' · ')}
                    </p>
                  </div>
                ) : null}
              </div>

              {hasFixedLocation ? (
                <a
                  href={place.googleMapsDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-full bg-slate-100 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Maps
                </a>
              ) : null}

              <div className="mt-4 flex justify-end">
                <ReportBusinessButton locale={locale} storeRef={store.slug} />
              </div>
            </div>
          </details>
        </div>
      </main>
    </>
  );
}
