'use client';

import { useEffect, useState } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import {
  ArrowRight,
  Check,
  Image as ImageIcon,
  MapPin,
  Sparkles,
  ThumbsDown,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';

type SmartMatch = {
  id: string;
  title: string;
  summary?: string | null;
  content_type?: string;
  cover_image?: string | null;
  price_cents?: number | null;
  currency?: string;
  city?: string | null;
  distance_km?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  score?: number;
  similarity_score?: number | null;
  worth_score?: number | null;
  score_label?: string;
  viewer_feedback?: 'approved' | 'rejected' | null;
  reasons?: string[];
  warnings?: string[];
  rating?: number | null;
  review_count?: number | null;
};

type SmartMatchAssessment = {
  id: string;
  similarity: number | null;
  fit: number | null;
  worth_it: number | null;
  reason: string;
  caution: string;
};

type SmartMatchPayload = {
  intent?: string;
  count?: number;
  results?: SmartMatch[];
  engine?: { name?: string; version?: string; mode?: string };
};

type SmartMatchAiPayload = {
  available?: boolean;
  ranked_candidate_ids?: string[];
  assessments?: SmartMatchAssessment[];
  confidence?: number | null;
};

function money(value: number | null | undefined, currency = 'IDR') {
  if (!Number.isFinite(value as number)) return '';

  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format((value as number) / 100);
  } catch {
    return `${currency} ${Math.round((value as number) / 100).toLocaleString('id-ID')}`;
  }
}

function budgetLabel(item: SmartMatch) {
  if (item.price_cents) return money(item.price_cents, item.currency);
  if (item.budget_min && item.budget_max) {
    return `${money(item.budget_min, item.currency)}–${money(item.budget_max, item.currency)}`;
  }
  if (item.budget_max) return `≤ ${money(item.budget_max, item.currency)}`;
  if (item.budget_min) return `≥ ${money(item.budget_min, item.currency)}`;
  return '';
}

function contentTypeLabel(contentType: string | undefined, locale: 'id' | 'en') {
  const value = (contentType || '').trim().toLowerCase();

  if (locale === 'en') {
    if (value.includes('request') || value.includes('demand')) return 'Need';
    if (value.includes('offer') || value.includes('supply')) return 'Offer';
    if (value.includes('service')) return 'Service';
    if (value.includes('product')) return 'Product';
    return 'Listing';
  }

  if (value.includes('request') || value.includes('demand')) return 'Kebutuhan';
  if (value.includes('offer') || value.includes('supply')) return 'Penawaran';
  if (value.includes('service')) return 'Jasa';
  if (value.includes('product')) return 'Produk';
  return 'Listing';
}

export function ContentSmartMatch({
  contentId,
  intent,
  locale = 'id',
  source,
}: {
  contentId: string;
  intent?: string;
  locale?: 'id' | 'en';
  source?: {
    title?: string;
    summary?: string | null;
    body?: string | null;
    category?: string | null;
    content_type?: string | null;
    price_cents?: number | null;
    price_unit?: string | null;
    city?: string | null;
  };
}) {
  const [payload, setPayload] = useState<SmartMatchPayload | null>(null);
  const [aiPayload, setAiPayload] = useState<SmartMatchAiPayload | null>(null);
  const [sort, setSort] = useState<
    'worth' | 'similarity' | 'nearest' | 'cheapest'
  >('worth');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState<Record<string, boolean>>(
    {},
  );
  const [feedbackRevision, setFeedbackRevision] = useState(0);

  const [matchesViewportRef] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    dragFree: true,
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(
      `/api/content/${encodeURIComponent(contentId)}/matches?sort=${sort}&limit=8`,
      {
        credentials: 'include',
        cache: 'no-store',
      },
    )
      .then(response => (response.ok ? response.json() : null))
      .then((data: SmartMatchPayload | null) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) setPayload(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contentId, sort]);

  const results = payload?.results ?? [];

  useEffect(() => {
    if (loading || results.length < 2) {
      setAiLoading(false);
      return;
    }

    let cancelled = false;
    setAiPayload(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2200);
    setAiLoading(true);

    fetch('/api/content/' + encodeURIComponent(contentId) + '/matches/ai', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locale,
        source: {
          id: contentId,
          title: source?.title || '',
          summary: source?.summary || '',
          body: source?.body || '',
          category: source?.category || '',
          content_type: source?.content_type || '',
          price_cents: source?.price_cents ?? null,
          price_unit: source?.price_unit || '',
          city: source?.city || '',
        },
        candidates: results.slice(0, 8),
      }),
    })
      .then(response => (response.ok ? response.json() : null))
      .then((data: SmartMatchAiPayload | null) => {
        if (!cancelled && data?.available) setAiPayload(data);
      })
      .catch(() => {
        if (!cancelled) setAiPayload(null);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [
    contentId,
    loading,
    locale,
    results,
    source?.title,
    source?.summary,
    source?.body,
    source?.category,
    source?.content_type,
    source?.price_cents,
    source?.price_unit,
    source?.city,
    feedbackRevision,
  ]);

  const requestError = !loading && payload === null;
  const aiOrder = new Map(
    (aiPayload?.ranked_candidate_ids || []).map((id, index) => [id, index]),
  );
  const aiAssessment = new Map(
    (aiPayload?.assessments || []).map(assessment => [assessment.id, assessment]),
  );
  const displayResults = aiPayload?.available
    ? [...results].sort((a, b) => {
        const aiA = aiOrder.get(a.id);
        const aiB = aiOrder.get(b.id);

        if (aiA == null && aiB == null) {
          return (
            (b.worth_score ?? b.score ?? 0) -
            (a.worth_score ?? a.score ?? 0)
          );
        }
        if (aiA == null) return 1;
        if (aiB == null) return -1;
        return aiA - aiB;
      })
    : results;

  const submitFeedback = async (
    matchId: string,
    feedbackType: 'approved' | 'rejected',
  ) => {
    if (feedbackSaving[matchId]) return;

    const previous =
      results.find(item => item.id === matchId)?.viewer_feedback ?? null;

    setFeedbackSaving(current => ({ ...current, [matchId]: true }));
    setPayload(current =>
      current
        ? {
            ...current,
            results: (current.results ?? []).map(item =>
              item.id === matchId
                ? { ...item, viewer_feedback: feedbackType }
                : item,
            ),
          }
        : current,
    );

    try {
      const response = await fetch(
        `/api/content/${encodeURIComponent(contentId)}/matches/feedback`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matched_content_id: matchId,
            feedback_type: feedbackType,
          }),
        },
      );

      if (!response.ok) {
        throw new Error('feedback failed');
      }

      setFeedbackRevision(current => current + 1);
    } catch {
      setPayload(current =>
        current
          ? {
              ...current,
              results: (current.results ?? []).map(item =>
                item.id === matchId
                  ? { ...item, viewer_feedback: previous }
                  : item,
              ),
            }
          : current,
      );
    } finally {
      setFeedbackSaving(current => {
        const next = { ...current };
        delete next[matchId];
        return next;
      });
    }
  };

  const isRequest =
    intent === 'request' || intent === 'demand' || intent === 'seeker';
  const title = isRequest
    ? locale === 'id'
      ? 'Rekomendasi yang cocok'
      : 'Recommended matches'
    : locale === 'id'
      ? 'Yang mungkin membutuhkan ini'
      : 'People who may need this';

  const matchCount = payload?.count ?? results.length;

  return (
    <section
      className="overflow-hidden rounded-[20px] bg-gradient-to-br from-emerald-800 via-emerald-900 to-slate-950 text-white shadow-[0_18px_45px_-30px_rgba(4,120,87,0.75)]"
      data-testid="content-smart-match"
    >
      <div className="px-3.5 pb-3 pt-3.5 sm:px-4 sm:pb-3.5 sm:pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-emerald-200">
              <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="text-[10px] font-black uppercase tracking-[0.14em]">
                Smart Match
              </span>
            </div>
            <h2 className="mt-1 text-[15px] font-black leading-5 text-white sm:text-base">
              {title}
            </h2>
          </div>

          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-emerald-900 shadow-sm">
            {loading
              ? '...'
              : aiLoading
                ? 'AI'
                : matchCount.toLocaleString(locale === 'id' ? 'id-ID' : 'en-US')}
          </span>
        </div>

        {!loading && results.length > 0 ? (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                ['worth', locale === 'id' ? 'Paling cocok' : 'Best fit'],
                ['similarity', locale === 'id' ? 'Paling mirip' : 'Most similar'],
                ['nearest', locale === 'id' ? 'Terdekat' : 'Nearest'],
                ['cheapest', locale === 'id' ? 'Harga' : 'Price'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setSort(value)}
                aria-pressed={sort === value}
                className={
                  sort === value
                    ? 'shrink-0 rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-emerald-900 shadow-sm'
                    : 'shrink-0 rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-bold text-emerald-50/80 ring-1 ring-white/10 hover:bg-white/15'
                }
              >
                {label}
              </button>
            ))}

            {results.length > 0 ? (
              <Link
                href={`/content/${contentId}/matches`}
                className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1.5 text-[10px] font-bold text-white/85 hover:bg-white/10"
              >
                {locale === 'id' ? 'Semua' : 'All'}
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      {!loading && results.length === 0 ? (
        <div className="mx-3.5 mb-3.5 rounded-2xl bg-white/[0.08] p-3.5 ring-1 ring-white/10 sm:mx-4 sm:mb-4">
          <p className="text-xs font-black text-white">
            {requestError
              ? locale === 'id'
                ? 'Smart Match belum tersedia.'
                : 'Smart Match is temporarily unavailable.'
              : locale === 'id'
                ? 'Belum ada yang cukup cocok.'
                : 'No strong matches yet.'}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-emerald-100/70">
            {requestError
              ? locale === 'id'
                ? 'Coba buka lagi beberapa saat.'
                : 'Try opening this again shortly.'
              : locale === 'id'
                ? 'Posting baru akan otomatis ikut dipertimbangkan.'
                : 'New posts will be considered automatically.'}
          </p>
        </div>
      ) : null}

      {!loading && results.length > 0 ? (
        <div
          className="overflow-hidden"
          ref={matchesViewportRef}
          aria-label={
            locale === 'id'
              ? 'Rekomendasi Smart Match'
              : 'Smart Match recommendations'
          }
        >
          <div className="flex gap-3 px-3.5 pb-3.5 sm:px-4 sm:pb-4">
            {displayResults.slice(0, 6).map(match => {
              const fit = Math.round(
                aiAssessment.get(match.id)?.fit ??
                  match.worth_score ??
                  match.score ??
                  match.similarity_score ??
                  0,
              );
              const typeLabel = contentTypeLabel(match.content_type, locale);
              const price = budgetLabel(match);
              const reason =
                aiAssessment.get(match.id)?.reason || match.reasons?.[0] || '';
              const caution =
                aiAssessment.get(match.id)?.caution || match.warnings?.[0] || '';

              return (
                <article
                  key={match.id}
                  className="group flex min-w-0 shrink-0 basis-[84%] flex-col overflow-hidden rounded-[18px] bg-white text-slate-950 shadow-[0_14px_30px_-24px_rgba(0,0,0,0.6)] ring-1 ring-white/10 sm:basis-[48%] lg:basis-[31%]"
                >
                  <Link
                    href={`/content/${match.id}`}
                    aria-label={match.title}
                    className="relative block aspect-[1.3/1] overflow-hidden bg-slate-100"
                  >
                    {match.cover_image?.trim() ? (
                      <img
                        src={match.cover_image.trim()}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <span className="grid h-full w-full place-items-center bg-gradient-to-br from-emerald-50 via-slate-50 to-white text-emerald-700">
                        <ImageIcon
                          className="h-8 w-8"
                          aria-hidden="true"
                        />
                      </span>
                    )}

                    <div className="absolute inset-x-2 top-2 flex items-center justify-between gap-2">
                      <span className="max-w-[70%] truncate rounded-full bg-black/60 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
                        {typeLabel}
                      </span>
                      {fit > 0 ? (
                        <span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-emerald-900 shadow-sm">
                          {fit}% cocok
                        </span>
                      ) : null}
                    </div>
                  </Link>

                  <div className="flex min-h-0 flex-1 flex-col p-3">
                    <Link
                      href={`/content/${match.id}`}
                      className="line-clamp-2 text-[13px] font-black leading-5 text-slate-950 hover:underline sm:text-sm"
                    >
                      {match.title}
                    </Link>

                    <div className="mt-2 flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-xs font-black text-emerald-800">
                        {price || (locale === 'id' ? 'Harga nego' : 'Negotiable')}
                      </span>
                      {match.city ? (
                        <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" />
                      ) : null}
                      {match.city ? (
                        <span className="min-w-0 truncate text-[10px] font-semibold text-slate-500">
                          {match.city}
                        </span>
                      ) : null}
                    </div>

                    {(match.distance_km != null || match.rating != null) ? (
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-semibold text-slate-500">
                        {match.distance_km != null ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" aria-hidden="true" />
                            {match.distance_km < 1
                              ? '<1 km'
                              : `${match.distance_km} km`}
                          </span>
                        ) : null}
                        {match.rating != null ? (
                          <span>
                            ★ {match.rating.toFixed(1)}
                            {match.review_count ? ` · ${match.review_count}` : ''}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    {reason ? (
                      <p className="mt-2 line-clamp-2 rounded-xl bg-emerald-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-emerald-900">
                        {reason}
                      </p>
                    ) : caution ? (
                      <p className="mt-2 line-clamp-2 rounded-xl bg-amber-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-amber-900">
                        {caution}
                      </p>
                    ) : null}

                    <div className="mt-auto flex items-center gap-1.5 pt-3">
                      <button
                        type="button"
                        disabled={Boolean(feedbackSaving[match.id])}
                        onClick={() =>
                          void submitFeedback(match.id, 'approved')
                        }
                        aria-label={
                          locale === 'id'
                            ? 'Tandai cocok'
                            : 'Mark as good fit'
                        }
                        title={
                          locale === 'id'
                            ? 'Tandai cocok'
                            : 'Mark as good fit'
                        }
                        className={
                          match.viewer_feedback === 'approved'
                            ? 'inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-700 px-2.5 text-[10px] font-black text-white'
                            : 'inline-flex min-h-8 flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-50 px-2.5 text-[10px] font-black text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100'
                        }
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        {locale === 'id' ? 'Cocok' : 'Good fit'}
                      </button>

                      <button
                        type="button"
                        disabled={Boolean(feedbackSaving[match.id])}
                        onClick={() =>
                          void submitFeedback(match.id, 'rejected')
                        }
                        aria-label={
                          locale === 'id' ? 'Tidak cocok' : 'Not a fit'
                        }
                        title={
                          locale === 'id' ? 'Tidak cocok' : 'Not a fit'
                        }
                        className={
                          match.viewer_feedback === 'rejected'
                            ? 'inline-flex min-h-8 items-center justify-center rounded-xl bg-slate-700 px-2.5 text-[10px] font-black text-white'
                            : 'inline-flex min-h-8 items-center justify-center rounded-xl bg-slate-50 px-2.5 text-[10px] font-black text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100'
                        }
                      >
                        <ThumbsDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>

                      <Link
                        href={`/content/${match.id}`}
                        aria-label={
                          locale === 'id' ? 'Lihat posting' : 'View listing'
                        }
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-emerald-700 text-white transition hover:bg-emerald-800"
                      >
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4">
          <div className="flex gap-3 overflow-hidden">
            {[1, 2].map(item => (
              <div
                key={item}
                className="h-64 shrink-0 basis-[84%] animate-pulse rounded-[18px] bg-white/10 sm:basis-[48%]"
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );}
