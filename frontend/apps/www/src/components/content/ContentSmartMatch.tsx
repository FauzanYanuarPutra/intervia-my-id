'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, MapPin, Sparkles } from 'lucide-react';
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
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
  const requestError = !loading && payload === null;

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
              ? 'Lajukan mencocokkan lokasi, harga, kategori, ketersediaan, dan kecocokan isi posting.'
              : 'Lajukan compares location, price, category, availability, and listing relevance.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200 dark:bg-white/5 dark:text-emerald-300 dark:ring-emerald-300/20">
          {loading ? '...' : `${payload?.count ?? results.length} match`}
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
              : locale === 'id' ? 'Belum ada match yang cukup cocok.' : 'No strong match yet.'}
          </p>
          <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
            {requestError
              ? locale === 'id' ? 'Coba buka lagi beberapa saat. Fitur ini tetap aktif di belakang layar.' : 'Try again shortly. The matching engine remains active in the background.'
              : locale === 'id' ? 'Saat ada posting yang relevan, Lajukan akan menampilkannya di sini.' : 'When a relevant listing appears, Lajukan will show it here.'}
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {([
          ['best', locale === 'id' ? 'Paling cocok' : 'Best match'],
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
          {results.slice(0, 6).map(match => (
            <Link
              key={match.id}
              href={`/content/${match.id}`}
              className="group min-w-0 rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950 dark:ring-slate-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="line-clamp-2 text-sm font-bold leading-5 text-[color:var(--app-text)]">{match.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    {match.city ? <span>{match.city}</span> : null}
                    {match.distance_km != null ? <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{match.distance_km < 1 ? '<1 km' : `${match.distance_km} km`}</span> : null}
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-black text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {Math.round(match.score ?? 0)}%
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold text-[color:var(--app-text)]">{budgetLabel(match) || (locale === 'id' ? 'Harga nego' : 'Negotiable')}</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5" />
              </div>
              {match.reasons?.[0] ? <p className="mt-1 line-clamp-1 text-[10px] text-[color:var(--app-text-soft)]">{match.reasons[0]}</p> : null}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}