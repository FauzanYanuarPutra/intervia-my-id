'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, MapPin, Sparkles, ThumbsDown } from 'lucide-react';
import { Link } from '@/i18n/navigation';

type SmartMatch = {
  id: string;
  title: string;
  summary?: string | null;
  content_type?: string;
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
  const [sort, setSort] = useState<'worth' | 'similarity' | 'nearest' | 'cheapest'>('worth');
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  const [feedbackSaving, setFeedbackSaving] = useState<Record<string, boolean>>({});
  const [feedbackRevision, setFeedbackRevision] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAiPayload(null);
    fetch(`/api/content/${encodeURIComponent(contentId)}/matches?sort=${sort}&limit=8`, {
      credentials: 'include',
      cache: 'no-store',
    })
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

    fetch(
      '/api/content/' + encodeURIComponent(contentId) + '/matches/ai',
      {
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
      },
    )
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
          return (b.worth_score ?? b.score ?? 0) - (a.worth_score ?? a.score ?? 0);
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

    const previous = results.find(item => item.id === matchId)?.viewer_feedback ?? null;
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

  const isRequest = intent === 'request' || intent === 'demand' || intent === 'seeker';
  const title = isRequest
    ? locale === 'id' ? 'Yang mungkin cocok dengan kebutuhanmu' : 'Potential matches for your need'
    : locale === 'id' ? 'Yang mungkin sedang membutuhkan' : 'People who may need this';

  return (
    <section className="overflow-hidden rounded-[18px] border border-emerald-200/70 bg-emerald-50/60 p-3.5 shadow-sm dark:border-emerald-400/20 dark:bg-emerald-500/5 sm:rounded-[22px] sm:p-4" data-testid="content-smart-match">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-[0.12em]">
              Smart Match
            </span>
          </div>
          <h2 className="mt-1 text-base font-bold text-[color:var(--app-text)] sm:text-lg">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {locale === 'id'
              ? 'Lajukan mencocokkan isi, kategori, lokasi, harga, ketersediaan, kualitas listing, lalu AI menyempurnakan urutan kandidat teratas.'
              : 'Lajukan compares semantic fit, category, location, price, availability, and listing quality, then AI reranks the top candidates.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-white/5 dark:text-emerald-300 dark:ring-emerald-300/20">
          {loading ? '...' : aiLoading ? 'AI merapikan...' : `${payload?.count ?? results.length} match`}
        </span>
      </div>

      {!loading && results.length > 1 ? (
        <Link
          href={`/content/${contentId}/matches`}
          className="mb-2 flex items-center justify-between rounded-2xl bg-white px-3 py-2.5 text-xs font-black text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-50 dark:bg-slate-950 dark:text-emerald-300 dark:ring-emerald-400/20"
        >
          <span>Lihat & bandingkan {results.length} match</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}

      {!loading && results.length === 0 ? (
        <div className="mt-3 rounded-2xl bg-white/80 p-3 ring-1 ring-emerald-200/70 dark:bg-slate-950 dark:ring-emerald-400/20">
          <p className="text-xs font-bold text-[color:var(--app-text)]">
            {requestError
              ? locale === 'id' ? 'Smart Match belum bisa mengambil data.' : 'Smart Match could not load the data.'
              : locale === 'id' ? 'Belum ada match yang sangat kuat — kandidat yang masih relevan tetap ditampilkan.' : 'No very strong match yet — relevant lower-score candidates are still shown.'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
            {requestError
              ? locale === 'id' ? 'Coba buka lagi beberapa saat. Fitur ini tetap aktif di belakang layar.' : 'Try again shortly. The matching engine remains active in the background.'
              : locale === 'id' ? 'Semakin sering kamu menekan Sesuai atau Tidak sesuai, semakin jelas sinyal yang dipakai Lajukan untuk mengurutkan kandidat berikutnya.' : 'The more you mark matches as suitable or unsuitable, the better Lajukan can learn your preference for future rankings.'}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {([
          ['worth', locale === 'id' ? 'Paling worth it' : 'Best value'],
          ['similarity', locale === 'id' ? 'Paling mirip' : 'Most similar'],
          ['nearest', locale === 'id' ? 'Terdekat' : 'Nearest'],
          ['cheapest', locale === 'id' ? 'Harga' : 'Price'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSort(value)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition ${sort === value ? 'bg-emerald-700 text-white' : 'bg-white text-[color:var(--app-text-soft)] ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[1, 2].map(item => <div key={item} className="h-24 animate-pulse rounded-2xl bg-white/70 dark:bg-white/5" />)}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {displayResults.slice(0, 6).map(match => (
            <article
              key={match.id}
              className="group min-w-0 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950 dark:ring-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={`/content/${match.id}`}
                    className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)] hover:underline"
                  >
                    {match.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    {match.city ? <span>{match.city}</span> : null}
                    {match.distance_km != null ? <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{match.distance_km < 1 ? '<1 km' : `${match.distance_km} km`}</span> : null}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {Math.round(
                    aiAssessment.get(match.id)?.worth_it ??
                      match.worth_score ??
                      match.score ??
                      0,
                  )}% worth it
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold text-[color:var(--app-text)]">{budgetLabel(match) || (locale === 'id' ? 'Harga nego' : 'Negotiable')}</span>
                <Link
                  href={`/content/${match.id}`}
                  aria-label={locale === 'id' ? 'Lihat listing' : 'View listing'}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={Boolean(feedbackSaving[match.id])}
                  onClick={() => void submitFeedback(match.id, 'approved')}
                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-black transition disabled:opacity-50 ${
                    match.viewer_feedback === 'approved'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                  {locale === 'id' ? 'Sesuai' : 'Suitable'}
                </button>
                <button
                  type="button"
                  disabled={Boolean(feedbackSaving[match.id])}
                  onClick={() => void submitFeedback(match.id, 'rejected')}
                  className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2 text-[10px] font-black transition disabled:opacity-50 ${
                    match.viewer_feedback === 'rejected'
                      ? 'bg-slate-700 text-white'
                      : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-white/5 dark:text-white/70 dark:ring-white/10'
                  }`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" />
                  {locale === 'id' ? 'Tidak sesuai' : 'Not suitable'}
                </button>
              </div>
              {aiAssessment.get(match.id)?.reason || match.reasons?.[0] ? (
                <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                  {aiAssessment.get(match.id)?.reason || match.reasons?.[0]}
                  {match.similarity_score != null
                    ? ' · Mirip ' +
                      Math.round(
                        aiAssessment.get(match.id)?.similarity ??
                          match.similarity_score,
                      ) +
                      '%'
                    : ''}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}