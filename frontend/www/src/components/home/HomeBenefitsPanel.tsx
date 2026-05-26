'use client';

import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { Link } from '@/i18n/navigation';
import {
  ContentItem,
  extractContentItems,
  formatIDRFromCents,
  resolvePrimaryImage,
} from '@/lib/content/catalog';
import { createPromotionSnapshot } from '@/lib/content/promotionPrograms';
import { ArrowRight, BadgePercent, Gift, Sparkles, Trophy } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

type HomeBenefitsPanelProps = {
  locale: string;
};

type PromotionCard = {
  id: string;
  href: string;
  title: string;
  promoLabel: string;
  supportLabel: string;
  image: string;
  priceLabel: string;
  offerType: 'discount' | 'loyalty_card' | 'raffle' | 'other';
};

function normalizeStatus(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function HomeBenefitsPanel({ locale }: HomeBenefitsPanelProps) {
  const isId = locale === 'id';
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPromotions() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/content?limit=24&offset=0', {
          cache: 'no-store',
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(
            (payload as { error?: string }).error ||
              (isId
                ? 'Promo belum bisa dimuat sekarang.'
                : 'Promotions are unavailable right now.'),
          );
        }

        if (!cancelled) {
          setItems(extractContentItems(payload));
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : isId
                ? 'Promo belum bisa dimuat sekarang.'
                : 'Promotions are unavailable right now.',
          );
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPromotions();

    return () => {
      cancelled = true;
    };
  }, [isId]);

  const promotionCards = useMemo<PromotionCard[]>(() => {
    return items
      .filter(item => {
        const itemStatus = normalizeStatus(
          item.content_status || item.status || 'active',
        );
        if (itemStatus && itemStatus !== 'active') return false;
        const meta =
          item.metadata && typeof item.metadata === 'object'
            ? (item.metadata as Record<string, unknown>)
            : null;
        return Boolean(
          (typeof item.promo_label === 'string' && item.promo_label.trim()) ||
          (meta?.promotion && typeof meta.promotion === 'object'),
        );
      })
      .map(item => {
        const snapshot = createPromotionSnapshot(
          item.metadata && typeof item.metadata === 'object'
            ? (item.metadata as Record<string, unknown>).promotion
            : null,
          typeof item.price_cents === 'number' ? item.price_cents : undefined,
          isId ? 'id' : 'en',
        );
        const offerType: PromotionCard['offerType'] =
          snapshot?.offerType === 'discount' ||
          snapshot?.offerType === 'loyalty_card' ||
          snapshot?.offerType === 'raffle'
            ? snapshot.offerType
            : 'other';

        const promoLabel =
          snapshot?.promoLabel ||
          (typeof item.promo_label === 'string'
            ? item.promo_label.trim()
            : '') ||
          (isId ? 'Benefit aktif' : 'Active benefit');

        return {
          id: item.id,
          href: `/content/${encodeURIComponent(item.slug || item.id)}`,
          title:
            item.title ||
            item.summary ||
            (isId ? 'Promo aktif' : 'Active promo'),
          promoLabel,
          supportLabel:
            snapshot?.supportLabel ||
            (isId
              ? 'Cocok untuk checkout lebih menarik dan repeat order.'
              : 'Useful for stronger checkout and repeat orders.'),
          image: resolvePrimaryImage(item),
          priceLabel:
            typeof item.price_cents === 'number'
              ? formatIDRFromCents(item.price_cents)
              : isId
                ? 'Lihat detail'
                : 'See details',
          offerType,
        };
      })
      .slice(0, 4);
  }, [isId, items]);

  return (
    <section id="home-benefits" className="mt-5 md:mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] ui-accent-text">
            {isId ? 'Voucher & promo' : 'Vouchers and promos'}
          </p>
          <h2 className="mt-1 text-lg font-bold text-[color:var(--app-text)]">
            {isId
              ? 'Benefit yang harus kelihatan dari home'
              : 'Benefits that should be visible from home'}
          </h2>
          <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
            {isId
              ? 'Tarik user dengan diskon, loyalty, dan campaign aktif yang memang sudah dipasang di listing.'
              : 'Pull users in with discount, loyalty, and active campaigns already attached to listings.'}
          </p>
        </div>
        <Link
          href="/search"
          className="text-[11px] font-semibold ui-accent-text"
        >
          {isId ? 'Lihat semua listing' : 'Browse all listings'}
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/search?type=umkm"
          className="ui-inline-meta ui-accent-border ui-accent-text"
        >
          {isId ? 'Voucher usaha' : 'Business vouchers'}
        </Link>
        <Link
          href="/search?type=product"
          className="ui-inline-meta ui-info-border ui-info-text"
        >
          {isId ? 'Promo produk' : 'Product promos'}
        </Link>
        <Link
          href="/search?type=service"
          className="ui-inline-meta ui-supply-border ui-supply-text"
        >
          {isId ? 'Benefit jasa' : 'Service benefits'}
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="ui-panel rounded-3xl p-4">
              <div className="ui-skeleton ui-skeleton-pulse h-32 rounded-2xl" />
              <div className="ui-skeleton ui-skeleton-pulse mt-3 h-3 w-20 rounded-full" />
              <div className="ui-skeleton ui-skeleton-pulse mt-2 h-5 w-3/4 rounded-full" />
              <div className="ui-skeleton ui-skeleton-pulse mt-2 h-3 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : promotionCards.length === 0 ? (
        <div className="ui-panel-muted mt-4 rounded-3xl p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]">
              <Sparkles className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-[color:var(--app-text)]">
                {isId
                  ? 'Belum ada promo aktif yang bisa ditampilkan.'
                  : 'There are no active promos to show yet.'}
              </p>
              <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                {error ||
                  (isId
                    ? 'Jalur voucher/promo sudah siap muncul di home.'
                    : 'But the home entry point is ready, so once listings run promos, users will see them immediately.')}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {promotionCards.map(card => {
            const Icon =
              card.offerType === 'discount'
                ? BadgePercent
                : card.offerType === 'loyalty_card'
                  ? Gift
                  : card.offerType === 'raffle'
                    ? Trophy
                    : Sparkles;

            return (
              <Link
                key={card.id}
                href={card.href}
                className="ui-panel ui-card-hover group overflow-hidden rounded-3xl"
              >
                <div className="relative h-40 w-full overflow-hidden bg-[color:var(--app-surface-muted)]">
                  <Image
                    src={card.image}
                    alt={card.title}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-[1.03]"
                    sizes="(max-width: 768px) 100vw, 50vw"
                    unoptimized
                  />
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-warning)]">
                      <Icon className="h-3 w-3" />
                      {card.promoLabel}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text)]">
                      {card.priceLabel}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-[color:var(--app-text)]">
                    {card.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                    {card.supportLabel}
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold ui-accent-text">
                    {isId ? 'Buka detail promo' : 'Open promo detail'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
