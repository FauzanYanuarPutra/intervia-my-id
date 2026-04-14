'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { Search } from 'lucide-react';
import {
  asString,
  ContentItem,
  DEFAULT_CONTENT_IMAGE,
  extractContentItems,
  formatIDRFromCents,
  resolvePrimaryImage,
} from '@/lib/content/catalog';

type MicrogigCard = {
  id: string;
  title: string;
  summary: string;
  location: string;
  priceLabel: string;
  typeLabel: string;
  href: string;
  image: string;
};

function detectLocale(pathname: string): 'id' | 'en' {
  return pathname.startsWith('/id') ? 'id' : 'en';
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function mapToMicrogig(item: ContentItem, locale: 'id' | 'en'): MicrogigCard | null {
  const id = String(item.id || '').trim();
  if (!id) return null;

  const meta = item.metadata || {};
  const title = item.title || item.summary || asString(meta.name) || 'Untitled';
  const summary =
    item.summary || asString(meta.tagline) || asString(meta.description) || '';
  const location =
    asString(meta.location) ||
    asString(meta.city) ||
    asString(meta.region) ||
    'Indonesia';
  const price = formatIDRFromCents(item.price_cents);
  const priceLabel = price !== '-' ? price : locale === 'id' ? 'Negosiasi' : 'Negotiable';
  const typeLabel =
    asString(item.content_type) ||
    asString(item.category) ||
    asString(meta.type) ||
    'Microgig';
  const image = resolvePrimaryImage(item) || DEFAULT_CONTENT_IMAGE;

  return {
    id,
    title,
    summary,
    location,
    priceLabel,
    typeLabel,
    href: `/content/${slugify(title || 'listing')}-${encodeURIComponent(id)}`,
    image,
  };
}

export default function MicrogigsClient() {
  const pathname = usePathname();
  const locale = detectLocale(pathname);

  const [query, setQuery] = useState('');
  const [items, setItems] = useState<MicrogigCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set('type', 'job');
        params.set('limit', '36');
        params.set('offset', '0');
        const response = await fetch(`/api/content?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              (locale === 'id' ? 'Gagal memuat microgigs' : 'Failed to load microgigs'),
          );
        }

        const mapped = extractContentItems(payload)
          .map((item) => mapToMicrogig(item, locale))
          .filter((item): item is MicrogigCard => Boolean(item));

        setItems(mapped);
      } catch (err) {
        if ((err as { name?: string }).name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load');
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [locale]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.title} ${item.summary} ${item.location}`.toLowerCase().includes(q),
    );
  }, [items, query]);

  const text = {
    title: locale === 'id' ? 'Microgigs' : 'Microgigs',
    subtitle:
      locale === 'id'
        ? 'Tugas cepat dengan scope jelas, cocok untuk kebutuhan harian.'
        : 'Quick tasks with clear scope for everyday needs.',
    placeholder: locale === 'id' ? 'Cari microgig...' : 'Search microgigs...',
    empty: locale === 'id' ? 'Belum ada microgig tersedia.' : 'No microgigs available.',
    loading: locale === 'id' ? 'Memuat...' : 'Loading...',
    retry: locale === 'id' ? 'Coba lagi' : 'Retry',
  };

  return (
    <section className="page-shell py-10">
      <div className="page-rhythm">
        <div className="ui-panel ui-hero-panel p-6 sm:p-8">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
            {text.title}
          </p>
          <h1 className="mt-2 text-3xl font-[1000] tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {locale === 'id' ? 'Cari pekerjaan mikro yang tepat' : 'Find the right micro task'}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {text.subtitle}
          </p>

          <label className="mt-4 flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
            <Search className="h-4 w-4 text-[color:var(--app-text-soft)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.placeholder}
              className="w-full bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text-soft)]"
            />
          </label>
        </div>

        {error ? (
          <div className="rounded-2xl border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-sm text-[color:var(--app-warning)]">
            {error}
            <button
              type="button"
              onClick={() => setQuery((current) => current)}
              className="ml-2 text-[11px] font-semibold underline"
            >
              {text.retry}
            </button>
          </div>
        ) : loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`micro-skel-${index}`} className="ui-panel-muted h-32 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-6 py-12 text-center text-sm text-[color:var(--app-text-soft)]">
            {text.empty}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className="ui-panel ui-card-hover flex h-full flex-col overflow-hidden p-3"
              >
                <div className="aspect-[16/9] w-full overflow-hidden rounded-xl bg-[color:var(--app-surface-muted)]">
                  <img src={item.image} alt={item.title} className="h-full w-full object-cover" />
                </div>
                <div className="mt-3 flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    {item.typeLabel}
                  </div>
                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {item.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-[color:var(--app-text-soft)]">
                    {item.summary || item.location}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-[color:var(--app-text-soft)]">
                  <span>{item.location}</span>
                  <span className="font-semibold text-[color:var(--app-accent)]">{item.priceLabel}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
