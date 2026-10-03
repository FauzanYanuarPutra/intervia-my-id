'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Sparkles, WandSparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type QualityFix = {
  id: string;
  label: string;
  description: string;
  confidence: number;
  patch: Record<string, unknown>;
  safeAutoApply: boolean;
};

type QualityChoice = {
  unit: string;
  label: string;
  confidence: number;
  description: string;
};

type QualityResult = {
  status: 'ok' | 'review';
  provider: 'rules' | 'ollama+rules';
  confidence: number;
  likelyThing: string;
  likelyType: string;
  current: {
    type: string;
    typeLabel: string;
    price?: string;
    priceUnit?: string;
  };
  issues: Array<{
    code: string;
    severity: 'high' | 'medium' | 'low';
    title: string;
    detail: string;
  }>;
  quickFixes: QualityFix[];
  priceUnitChoices?: QualityChoice[];
  explanation: string;
};

type ListingQualityAssistantProps = {
  contentId: string;
  locale: string;
  onUpdated: (patch: Record<string, unknown>, response: Record<string, unknown>) => void;
};

function labelUnit(value: string) {
  const map: Record<string, string> = {
    product: 'Produk',
    service: 'Jasa',
    job: 'Lowongan',
    property: 'Properti',
    tool_rental: 'Sewa alat',
    company: 'Perusahaan',
    other: 'Lainnya',
    kg: 'kg',
    pcs: 'pcs',
    project: 'proyek',
    session: 'sesi',
    hour: 'jam',
    day: 'hari',
    month: 'bulan',
  };
  return map[value] || value;
}

export function ListingQualityAssistant({
  contentId,
  locale,
  onUpdated,
}: ListingQualityAssistantProps) {
  const { authFetch } = useAuth();
  const [result, setResult] = useState<QualityResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const language = locale === 'en' ? 'en' : 'id';

  const analyze = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await authFetch(
        `/api/ai/listing-quality/${encodeURIComponent(contentId)}`,
      );
      const payload = (await response.json().catch(() => ({}))) as QualityResult & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Analisis listing gagal.');
      setResult(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analisis listing gagal.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void analyze();
    // Intentional: analyze once per listing mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentId]);

  const hasIssue = result?.status === 'review';
  const topFix = useMemo(
    () => result?.quickFixes.find(fix => fix.safeAutoApply) || null,
    [result],
  );

  const applyPatch = async (
    id: string,
    patch: Record<string, unknown>,
    successText: string,
  ) => {
    if (applying) return;
    setApplying(id);
    setError('');
    setMessage('');

    try {
      const response = await authFetch(
        `/api/content/${encodeURIComponent(contentId)}`,
        {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            'x-lajukan-ai-assist': '1',
          },
          body: JSON.stringify(patch),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown> & {
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error || 'Perubahan gagal disimpan.');

      onUpdated(patch, payload);
      setMessage(
        successText ||
          (language === 'id'
            ? 'Sudah diperbaiki. Listing tetap mengikuti alur review Lajukan.'
            : 'Fixed. The listing still follows Lajukan review rules.'),
      );
      await analyze();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Perubahan gagal disimpan.');
    } finally {
      setApplying(null);
    }
  };

  if (loading) {
    return (
      <section className="mb-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
          {language === 'id' ? 'AI sedang mengecek isi listing…' : 'AI is checking this listing…'}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
              {language === 'id' ? 'AI belum bisa menganalisis sekarang.' : 'AI analysis is unavailable right now.'}
            </p>
            <p className="mt-1 text-xs leading-5 text-amber-800/80 dark:text-amber-200/70">{error}</p>
            <button
              type="button"
              onClick={() => void analyze()}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {language === 'id' ? 'Coba lagi' : 'Try again'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!result) return null;

  if (!hasIssue) {
    return (
      <section className="mb-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                {language === 'id' ? 'Listing terlihat konsisten' : 'Listing looks consistent'}
              </p>
              <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700/70">
                AI
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-emerald-800/80 dark:text-emerald-200/70">
              {result.likelyThing}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void analyze()}
            className="rounded-full p-2 text-emerald-700 transition hover:bg-emerald-100 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
            aria-label={language === 'id' ? 'Analisis ulang' : 'Re-analyze'}
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-950/50">
          <Sparkles className="h-4.5 w-4.5 text-amber-700 dark:text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-black text-amber-950 dark:text-amber-100">
              {language === 'id'
                ? 'AI menemukan kemungkinan salah input'
                : 'AI found a possible input mismatch'}
            </p>
            <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-amber-900 dark:bg-amber-900/60 dark:text-amber-100">
              {Math.round(result.confidence * 100)}%
            </span>
          </div>

          <p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-100/75">
            <strong>{language === 'id' ? 'Terbaca sebagai:' : 'Detected as:'}</strong>{' '}
            {result.likelyThing} · {labelUnit(result.likelyType)}
          </p>

          <div className="mt-3 rounded-xl border border-amber-200/80 bg-white/70 p-3 text-xs dark:border-amber-900/50 dark:bg-slate-950/30">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>
                {language === 'id' ? 'Sekarang:' : 'Current:'}{' '}
                <strong>{result.current.typeLabel}</strong>
              </span>
              {result.current.price ? (
                <span>
                  {result.current.price}
                  {result.current.priceUnit ? ` / ${labelUnit(result.current.priceUnit)}` : ''}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {result.issues.map(issue => (
              <div key={issue.code} className="text-xs leading-5 text-amber-900/85 dark:text-amber-100/80">
                <strong>{issue.title}</strong>
                <div>{issue.detail}</div>
              </div>
            ))}
          </div>

          {topFix ? (
            <button
              type="button"
              disabled={Boolean(applying)}
              onClick={() =>
                void applyPatch(
                  topFix.id,
                  topFix.patch,
                  language === 'id'
                    ? 'Jenis listing sudah diperbaiki.'
                    : 'Listing type has been fixed.',
                )
              }
              className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[color:var(--app-accent)] px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
            >
              {applying === topFix.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <WandSparkles className="h-4 w-4" />
              )}
              {applying === topFix.id
                ? language === 'id'
                  ? 'Memperbaiki…'
                  : 'Fixing…'
                : topFix.label}
            </button>
          ) : null}

          {result.priceUnitChoices?.length ? (
            <div className="mt-3">
              <p className="mb-2 text-[11px] font-bold text-amber-950/80 dark:text-amber-100/80">
                {language === 'id'
                  ? 'Satuan harga belum cukup pasti. Pilih yang memang kamu maksud:'
                  : 'The price unit is ambiguous. Pick the one you actually mean:'}
              </p>
              <div className="flex flex-wrap gap-2">
                {result.priceUnitChoices.map(choice => {
                  const id = `price-unit-${choice.unit}`;
                  return (
                    <button
                      key={choice.unit}
                      type="button"
                      disabled={Boolean(applying)}
                      onClick={() =>
                        void applyPatch(
                          id,
                          { price_unit: choice.unit },
                          language === 'id'
                            ? `Satuan harga diubah menjadi per ${labelUnit(choice.unit)}.`
                            : `Price unit changed to per ${labelUnit(choice.unit)}.`,
                        )
                      }
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-black text-amber-950 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-800 dark:bg-slate-950/30 dark:text-amber-100 dark:hover:bg-amber-950/40"
                    >
                      <span>{result.current.price ? `${result.current.price} / ${labelUnit(choice.unit)}` : `Per ${labelUnit(choice.unit)}`}</span>
                      <span className="text-[10px] opacity-60">
                        {Math.round(choice.confidence * 100)}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] leading-4 text-amber-900/65 dark:text-amber-100/60">
              {result.explanation}
            </p>
            <button
              type="button"
              onClick={() => void analyze()}
              className="shrink-0 rounded-full p-2 text-amber-800 transition hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-950/40"
              aria-label={language === 'id' ? 'Analisis ulang' : 'Re-analyze'}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {message ? (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
              {message}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
