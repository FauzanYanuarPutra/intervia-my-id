import { NextRequest, NextResponse } from 'next/server';
import { listUmkmProducts, listUmkmStores } from '@/lib/super-app/umkm-commerce';
import { buildUmkmStorefrontPath } from '@/lib/umkmSurface';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readTexts(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function isVideo(value: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(value);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') || '').trim();
  const slug = (url.searchParams.get('store') || '').trim();
  const city = (url.searchParams.get('city') || '').trim();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || '18') || 18, 1), 60);

  const stores = await listUmkmStores({
    query: q || undefined,
    slug: slug || undefined,
    city: city || undefined,
    activeOnly: true,
    limit: 120,
  });

  const items = (await Promise.all(
    stores.map(async store => {
      const metadata = asRecord(store.metadata);
      const products = await listUmkmProducts({ storeId: store.id, includeUnavailable: false, limit: 4 });
      const media = unique([
        ...readTexts(metadata.reel_videos),
        ...readTexts(metadata.short_videos),
        ...readTexts(metadata.video_urls),
        ...readTexts(metadata.videos),
        ...readTexts(metadata.reels),
        ...readTexts(metadata.gallery),
        ...readTexts(metadata.photos),
        ...readTexts(metadata.store_photo_url),
        ...readTexts(metadata.menu_photo_url),
      ]).slice(0, 4);

      return media.map((mediaUrl, index) => ({
        id: `${store.id}-${index}`,
        mediaUrl,
        mediaType: isVideo(mediaUrl) ? 'video' : 'image',
        title: products[index]?.name || store.name,
        caption: products[index]?.description || store.description || store.city,
        hook: index === 0 ? 'Proses usaha dan bukti eksekusi.' : index === 1 ? 'Produk unggulan yang paling relevan.' : 'Suasana toko dan ritme operasional.',
        store: {
          id: store.id,
          slug: store.slug,
          name: store.name,
          city: store.city,
          phone: store.phone,
          storefrontPath: buildUmkmStorefrontPath(store.slug),
        },
      }));
    }),
  ))
    .flat()
    .slice(0, limit);

  return NextResponse.json({ data: items, count: items.length, stores: stores.length });
}