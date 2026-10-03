'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, MapPin, Sparkles } from 'lucide-react';
import { useParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';

type Match = {
  id: string;
  title: string;
  summary?: string | null;
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
  matched_fields?: string[];
};

function money(value?: number | null, currency = 'IDR') {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'IDR' ? 0 : 2,
  }).format(value / 100);
}

function price(item: Match) {
  if (item.price_cents != null) return money(item.price_cents, item.currency);
  if (item.budget_min != null && item.budget_max != null) {
    return `${money(item.budget_min, item.currency)}–${money(item.budget_max, item.currency)}`;
  }
  if (item.budget_max != null) return `≤ ${money(item.budget_max, item.currency)}`;
  return 'Harga nego';
}

export default function SmartMatchCompareClient() {
  const params = useParams();
  const contentId = String(params.id || '');
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!contentId) return;
    let cancelled = false;
    fetch(`/api/content/${encodeURIComponent(contentId)}/matches?sort=worth&limit=8`, {
      credentials: 'include',
      cache: 'no-store',
    })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!cancelled) setMatches(data?.results ?? []);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [contentId]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <Link
        href={`/content/${contentId}`}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--app-text-soft)] hover:text-[color:var(--app-text)]"
      >
        <ArrowLeft className="h-4 w-4" /> Kembali ke listing
      </Link>

      <div className="mt-5 rounded-[24px] border border-emerald-200/70 bg-emerald-50/60 p-4 dark:border-emerald-400/20 dark:bg-emerald-500/5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-2.5 text-emerald-700 shadow-sm dark:bg-slate-950 dark:text-emerald-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">Smart Match</p>
            <h1 className="mt-1 text-xl font-black text-[color:var(--app-text)] sm:text-2xl">Bandingkan yang paling cocok</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              Lajukan mengurutkan dari kecocokan dan value: kemiripan isi, lokasi, harga/budget, ketersediaan, kualitas listing, dan trust. Urutan ini tetap punya fallback cepat kalau AI tidak tersedia.
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <div key={i} className="h-52 animate-pulse rounded-3xl bg-slate-100 dark:bg-white/5" />)}
        </div>
      ) : matches.length === 0 ? (
        <div className="mt-4 rounded-3xl border border-slate-200 p-8 text-center dark:border-slate-800">
          <p className="font-bold text-[color:var(--app-text)]">Belum ada kecocokan yang cukup kuat.</p>
          <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">Lajukan akan mencoba mencocokkan lagi ketika ada listing baru yang relevan.</p>
        </div>
      ) : (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map((match, index) => (
              <article key={match.id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-[color:var(--app-text-soft)]">Pilihan {index + 1}</span>
                    <h2 className="mt-1 line-clamp-2 text-base font-black text-[color:var(--app-text)]">{match.title}</h2>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {Math.round(match.worth_score ?? match.score ?? 0)}% worth
                  </span>
                </div>

                <div className="mt-3 space-y-2 text-xs text-[color:var(--app-text-soft)]">
                  <div className="flex justify-between gap-3"><span>Harga</span><strong className="text-[color:var(--app-text)]">{price(match)}</strong></div>
                  {match.city ? <div className="flex justify-between gap-3"><span>Lokasi</span><span className="text-right">{match.city}</span></div> : null}
                  {match.distance_km != null ? <div className="flex justify-between gap-3"><span>Jarak</span><span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{match.distance_km < 1 ? '<1 km' : `${match.distance_km} km`}</span></div> : null}
                  {match.rating != null ? <div className="flex justify-between gap-3"><span>Rating</span><span>{match.rating.toFixed(1)} ({match.review_count ?? 0})</span></div> : null}
                  {match.similarity_score != null ? <div className="flex justify-between gap-3"><span>Kemiripan</span><span>{Math.round(match.similarity_score)}%</span></div> : null}
                </div>

                {match.reasons?.length ? (
                  <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs leading-5 dark:bg-white/5">
                    <p className="font-bold text-[color:var(--app-text)]">Kenapa cocok?</p>
                    <p className="mt-1 text-[color:var(--app-text-soft)]">{match.reasons.slice(0, 2).join(' · ')}</p>
                  </div>
                ) : null}

                {match.warnings?.length ? (
                  <p className="mt-2 text-[10px] leading-4 text-amber-700 dark:text-amber-300">{match.warnings[0]}</p>
                ) : null}

                <Link
                  href={`/content/${match.id}`}
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-700 px-3 py-2.5 text-xs font-black text-white transition hover:bg-emerald-800"
                >
                  Lihat listing <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
