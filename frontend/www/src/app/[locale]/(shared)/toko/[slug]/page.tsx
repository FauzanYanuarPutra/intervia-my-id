import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { getBaseUrl } from '@/lib/server/getBaseUrl';
import { localProductImageForCategory } from '@/lib/media/localSeedMedia';
import {
  getUmkmStoreBySlug,
  listUmkmProducts,
  type UmkmProduct,
  type UmkmStore,
} from '@/lib/super-app/umkm-commerce';
import { buildUmkmPlacePresentation } from '@/lib/super-app/umkm-place-ui';
import { serializeJsonLd } from '@/lib/seo/jsonLd';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

function readMetaText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function formatIdr(valueCents: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.round(valueCents / 100)));
}

function cleanPhone(value: string | null | undefined): string {
  return (value || '').replace(/[^\d+]/g, '');
}

function whatsappHref(phone: string | null | undefined, storeName: string): string | null {
  const cleaned = cleanPhone(phone);
  if (!cleaned) return null;
  const normalized = cleaned.startsWith('+')
    ? cleaned.slice(1)
    : cleaned.startsWith('0')
      ? `62${cleaned.slice(1)}`
      : cleaned;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(
    `Halo ${storeName}, saya lihat toko Anda di Lajukan.`,
  )}`;
}

function productImage(product: UmkmProduct): string {
  return (
    product.image_url ||
    readMetaText(product.metadata?.image_url) ||
    localProductImageForCategory(product.category || 'daily_needs', product.id)
  );
}

function StoreBadge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-full border border-emerald-100 bg-emerald-50 px-3 text-xs font-bold text-emerald-800">
      {children}
    </span>
  );
}

function ProductCard({ product }: { product: UmkmProduct }) {
  const available = product.is_available && product.stock_qty > 0;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative aspect-[4/3] bg-slate-100">
        <Image
          src={productImage(product)}
          alt={product.name}
          fill
          sizes="(min-width: 1024px) 280px, (min-width: 640px) 45vw, 92vw"
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="line-clamp-2 text-base font-bold text-slate-950">
            {product.name}
          </h3>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {available ? 'Ready' : 'Habis'}
          </span>
        </div>
        {product.description ? (
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">
            {product.description}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-emerald-700">
            {formatIdr(product.price_cents)}
          </p>
          <p className="text-xs font-semibold text-slate-500">
            Stok {Math.max(0, product.stock_qty)}
          </p>
        </div>
      </div>
    </article>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

async function getStoreProducts(store: UmkmStore): Promise<UmkmProduct[]> {
  try {
    return await listUmkmProducts({
      storeId: store.id,
      includeUnavailable: true,
      limit: 8,
    });
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const store = await getUmkmStoreBySlug(slug);

  if (!store) {
    return {
      title: locale === 'id' ? 'Toko Tidak Ketemu | Lajukan' : 'Business Not Found | Lajukan',
    };
  }

  const baseUrl = await getBaseUrl();
  const publicUrl = `${baseUrl}/${locale}/toko/${store.slug}`;
  const openHours = readMetaText(store.metadata.open_hours);

  return {
    title: locale === 'id' ? `${store.name} | Toko Lajukan` : `${store.name} | Lajukan Store`,
    description:
      store.description ||
      `${store.name} di ${store.city}. Lihat info toko, rating, komentar, dan tombol pesan langsung di Lajukan.`,
    alternates: {
      canonical: publicUrl,
    },
    openGraph: {
      title: store.name,
      description:
        store.description ||
        `${store.name} di ${store.city}${openHours ? `, buka ${openHours}` : ''}.`,
      url: publicUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: store.name,
      description:
        store.description ||
        `${store.name} di ${store.city}${openHours ? `, buka ${openHours}` : ''}.`,
    },
  };
}

export default async function TokoPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const store = await getUmkmStoreBySlug(slug);

  if (!store) {
    notFound();
  }

  const baseUrl = await getBaseUrl();
  const publicUrl = `${baseUrl}/${locale}/toko/${store.slug}`;
  const metadata = store.metadata && typeof store.metadata === 'object' ? store.metadata : {};
  const ratingValue = typeof metadata.rating_avg === 'number' ? metadata.rating_avg : null;
  const ratingCount = typeof metadata.rating_count === 'number' ? metadata.rating_count : null;
  const products = await getStoreProducts(store);
  const place = buildUmkmPlacePresentation(store, locale === 'id', null);
  const waHref = whatsappHref(store.phone, store.name);
  const telHref = cleanPhone(store.phone) ? `tel:${cleanPhone(store.phone)}` : null;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: store.name,
    description: store.description || undefined,
    telephone: store.phone || undefined,
    url: publicUrl,
    address: {
      '@type': 'PostalAddress',
      streetAddress: store.address,
      addressLocality: store.city,
      addressCountry: 'ID',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: store.lat,
      longitude: store.lng,
    },
    openingHours: readMetaText(metadata.open_hours) || undefined,
  };

  if (ratingValue !== null && ratingCount !== null && ratingCount > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue,
      reviewCount: ratingCount,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <main className="min-h-screen bg-slate-50 px-3 py-4 text-slate-950 sm:px-5 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="relative min-h-[260px] bg-slate-900 sm:min-h-[360px]">
              <Image
                src={place.coverImage}
                alt={store.name}
                fill
                priority
                sizes="100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/88 via-slate-950/28 to-transparent" />
              <div className="absolute left-4 right-4 top-4 flex items-center justify-between gap-3">
                <Link
                  href={`/${locale}/umkm`}
                  className="inline-flex min-h-10 items-center rounded-full bg-white/94 px-4 text-sm font-bold text-slate-900 shadow-sm"
                >
                  Kembali
                </Link>
                <span className="rounded-full bg-emerald-500 px-3 py-2 text-xs font-bold text-white">
                  {place.statusLabel}
                </span>
              </div>
              <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-bold ">
                    {place.categoryLabel}
                  </span>
                  <span className="rounded-full bg-white/16 px-3 py-1.5 text-xs font-bold ">
                    {store.city}
                  </span>
                </div>
                <h1 className="mt-3 max-w-3xl text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
                  {store.name}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/82 sm:text-base">
                  {store.description ||
                    `Toko UMKM di ${store.city}. Lihat produk, alamat, dan hubungi pemilik toko langsung dari Lajukan.`}
                </p>
              </div>
            </div>

            <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:p-6">
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <StoreBadge>{place.openHours}</StoreBadge>
                  <StoreBadge>{place.ratingLabel}</StoreBadge>
                  <StoreBadge>{products.length} produk</StoreBadge>
                </div>

                <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold">Produk dari toko ini</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Pilih produk yang cocok, lalu hubungi toko untuk ketersediaan terbaru.
                      </p>
                    </div>
                    {waHref ? (
                      <a
                        href={waHref}
                        className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white"
                      >
                        Chat toko
                      </a>
                    ) : null}
                  </div>

                  {products.length > 0 ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {products.map(product => (
                        <ProductCard key={product.id} product={product} />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                      <p className="font-bold text-slate-800">Produk belum ditampilkan.</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Hubungi toko untuk bertanya stok atau katalog terbaru.
                      </p>
                    </div>
                  )}
                </section>
              </div>

              <aside className="space-y-3 lg:sticky lg:top-4 lg:self-start">
                <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h2 className="text-base font-bold">Info toko</h2>
                  <div className="mt-3 grid gap-2">
                    <InfoRow label="Alamat" value={place.addressLine || store.address} />
                    <InfoRow label="Jam buka" value={place.openHours} />
                    <InfoRow label="Rating" value={place.ratingLabel} />
                  </div>
                  <div className="mt-4 grid gap-2">
                    {waHref ? (
                      <a
                        href={waHref}
                        className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-emerald-600 px-4 text-sm font-bold text-white"
                      >
                        Chat WhatsApp
                      </a>
                    ) : null}
                    {telHref ? (
                      <a
                        href={telHref}
                        className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-800"
                      >
                        Telepon
                      </a>
                    ) : null}
                    <a
                      href={place.googleMapsDirectionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 px-4 text-sm font-bold text-slate-800"
                    >
                      Buka Maps
                    </a>
                  </div>
                </div>

                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-950">
                  <p className="text-sm font-bold">Tips aman</p>
                  <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                    Pastikan stok, harga, dan cara pengiriman sebelum membayar. Simpan bukti
                    chat dan transaksi.
                  </p>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
