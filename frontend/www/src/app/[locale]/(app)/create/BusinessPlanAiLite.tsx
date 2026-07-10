'use client';

import { useState } from 'react';
import { useLocale } from 'next-intl';
import {
  ArrowRight,
  Calculator,
  Loader2,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Wrench,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { buildCreateBasePath } from './createPageUtils';

type BusinessPlanItem = {
  label: string;
  note: string;
  query: string;
};

type BusinessPlan = {
  provider: 'local-rules' | 'ollama+rules';
  ideaTitle: string;
  summary: string;
  budget: Array<{ label: string; amount: number; note: string }>;
  needs: {
    supplies: BusinessPlanItem[];
    equipment: BusinessPlanItem[];
    packaging: BusinessPlanItem[];
    services: BusinessPlanItem[];
  };
  estimates: {
    startingBudgetMin: number;
    startingBudgetMax: number;
    sellingPriceRange: string;
    grossMarginRange: string;
    breakEvenRange: string;
    caveat: string;
  };
  risks: string[];
  firstSteps: string[];
  searchQueries: string[];
};

const INTEREST_OPTIONS = [
  'minuman coklat',
  'kopi cup',
  'snack repack',
  'frozen food',
  'jasa desain/foto produk',
  'fashion reseller',
  'usaha umum',
];

function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function searchHref(query: string) {
  return `/search?q=${encodeURIComponent(query)}`;
}

function NeedGroup({
  title,
  items,
  icon: Icon,
}: {
  title: string;
  items: BusinessPlanItem[];
  icon: typeof Package;
}) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
          <Icon className="h-4 w-4" />
        </span>
        <p className="text-[12px] font-bold text-slate-900">{title}</p>
      </div>
      <div className="mt-3 space-y-2">
        {items.slice(0, 3).map(item => (
          <div key={`${title}-${item.label}`} className="min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-slate-800">
                  {item.label}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-5 text-slate-500">
                  {item.note}
                </p>
              </div>
              <Link
                href={searchHref(item.query)}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
                aria-label={`Cari ${item.label}`}
              >
                <Search className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function BusinessPlanAiLite() {
  const locale = useLocale() === 'en' ? 'en' : 'id';
  const demandHref = buildCreateBasePath({ locale, sideId: 'demand' });
  const [capital, setCapital] = useState('3000000');
  const [city, setCity] = useState('Bandung');
  const [interest, setInterest] = useState('minuman coklat');
  const [target, setTarget] = useState('jualan depan rumah sore-malam');
  const [experience, setExperience] = useState('beginner');
  const [plan, setPlan] = useState<BusinessPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const capitalNumber = Number(capital.replace(/[^\d]/g, '')) || 0;

  async function requestPlan() {
    if (!interest.trim() || loading) return;
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/ai/business-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          capital: capitalNumber,
          city,
          interest,
          target,
          experience,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: BusinessPlan;
        error?: string;
      };
      if (!response.ok || !payload.data) {
        throw new Error(
          payload.error ||
            (locale === 'id'
              ? 'AI belum bisa membuat rencana usaha.'
              : 'AI could not create the business plan.'),
        );
      }
      setPlan(payload.data);
    } catch (err) {
      setPlan(null);
      setError(
        err instanceof Error
          ? err.message
          : locale === 'id'
            ? 'Gagal membuat rencana usaha.'
            : 'Failed to create business plan.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-5 rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#f7fff9_0%,#ffffff_100%)] p-4 shadow-[0_18px_36px_-32px_rgba(22,163,74,0.24)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_14px_24px_-18px_rgba(22,163,74,0.55)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[16px] font-bold tracking-[-0.03em] text-slate-900">
              {locale === 'id'
                ? 'AI Paket Usaha Lite'
                : 'Lite Business Package AI'}
            </p>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-slate-500">
              {locale === 'id'
                ? 'Bantu susun ide, kebutuhan bahan, alat, kemasan, jasa, estimasi modal, risiko, dan langkah mulai. Ringan untuk laptop karena tetap punya mode rumus lokal.'
                : 'Build an idea, supplies, tools, packaging, services, budget estimate, risks, and first steps. It stays laptop-friendly with local rules fallback.'}
            </p>
          </div>
        </div>
        <span
          className={cn(
            'inline-flex w-fit items-center rounded-full border px-3 py-1 text-[10px] font-bold',
            plan?.provider === 'ollama+rules'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-600',
          )}
        >
          {plan?.provider === 'ollama+rules'
            ? 'Ollama lokal aktif'
            : 'Mode ringan siap'}
        </span>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[150px_150px_180px_minmax(0,1fr)_132px]">
        <label className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {locale === 'id' ? 'Modal' : 'Capital'}
          </span>
          <input
            value={capital}
            onChange={event => setCapital(event.target.value)}
            inputMode="numeric"
            className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-900 outline-none transition focus:border-emerald-400"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {locale === 'id' ? 'Kota' : 'City'}
          </span>
          <input
            value={city}
            onChange={event => setCity(event.target.value)}
            className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-900 outline-none transition focus:border-emerald-400"
          />
        </label>
        <label className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {locale === 'id' ? 'Minat' : 'Interest'}
          </span>
          <select
            value={interest}
            onChange={event => setInterest(event.target.value)}
            className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-900 outline-none transition focus:border-emerald-400"
          >
            {INTEREST_OPTIONS.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {locale === 'id' ? 'Target jualan' : 'Selling target'}
          </span>
          <input
            value={target}
            onChange={event => setTarget(event.target.value)}
            className="mt-1 h-11 w-full rounded-[14px] border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-900 outline-none transition focus:border-emerald-400"
          />
        </label>
        <button
          type="button"
          onClick={() => void requestPlan()}
          disabled={loading || !interest.trim()}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-emerald-600 px-4 text-[12px] font-bold text-white shadow-[0_16px_28px_-20px_rgba(22,163,74,0.58)] transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 md:mt-5"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="h-4 w-4" />
          )}
          {locale === 'id' ? 'Buat paket' : 'Build plan'}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {[
          ['beginner', locale === 'id' ? 'Pemula' : 'Beginner'],
          ['side_income', locale === 'id' ? 'Sampingan' : 'Side income'],
          ['scale_up', locale === 'id' ? 'Mau naik kelas' : 'Scaling up'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setExperience(value)}
            className={cn(
              'inline-flex h-8 items-center rounded-full border px-3 text-[11px] font-bold transition',
              experience === value
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mt-4 rounded-[16px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-semibold text-rose-700">
          {error}
        </div>
      ) : null}

      {plan ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-[20px] border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-[18px] font-bold tracking-[-0.03em] text-slate-900">
                  {plan.ideaTitle}
                </p>
                <p className="mt-1 max-w-3xl text-[12px] leading-5 text-slate-500">
                  {plan.summary}
                </p>
              </div>
              <div className="shrink-0 rounded-[16px] bg-emerald-50 px-3 py-2 text-right">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700">
                  {locale === 'id' ? 'Mulai aman' : 'Safe start'}
                </p>
                <p className="mt-0.5 text-[13px] font-bold text-emerald-800">
                  {formatRupiah(plan.estimates.startingBudgetMin)} -{' '}
                  {formatRupiah(plan.estimates.startingBudgetMax)}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-5">
            {plan.budget.map(item => (
              <div
                key={item.label}
                className="rounded-[18px] border border-slate-200 bg-white p-3"
              >
                <p className="text-[11px] font-bold text-slate-500">
                  {item.label}
                </p>
                <p className="mt-1 text-[14px] font-bold text-slate-900">
                  {formatRupiah(item.amount)}
                </p>
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-4 text-slate-500">
                  {item.note}
                </p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 lg:grid-cols-4">
            <NeedGroup title="Bahan" items={plan.needs.supplies} icon={Package} />
            <NeedGroup title="Alat" items={plan.needs.equipment} icon={Wrench} />
            <NeedGroup title="Kemasan" items={plan.needs.packaging} icon={Store} />
            <NeedGroup title="Jasa" items={plan.needs.services} icon={Sparkles} />
          </div>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="rounded-[18px] border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-700" />
                <p className="text-[12px] font-bold text-slate-900">
                  {locale === 'id' ? 'Estimasi usaha' : 'Business estimate'}
                </p>
              </div>
              <div className="mt-3 grid gap-2 text-[12px] text-slate-600">
                <p>
                  <span className="font-bold text-slate-900">Harga jual: </span>
                  {plan.estimates.sellingPriceRange}
                </p>
                <p>
                  <span className="font-bold text-slate-900">Margin: </span>
                  {plan.estimates.grossMarginRange}
                </p>
                <p>
                  <span className="font-bold text-slate-900">Balik modal: </span>
                  {plan.estimates.breakEvenRange}
                </p>
                <p className="rounded-[14px] bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-5 text-amber-800">
                  {plan.estimates.caveat}
                </p>
              </div>
            </div>

            <div className="rounded-[18px] border border-amber-200 bg-amber-50/80 p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-amber-700" />
                <p className="text-[12px] font-bold text-amber-950">
                  {locale === 'id' ? 'Risiko yang perlu dicek' : 'Risks to check'}
                </p>
              </div>
              <div className="mt-3 grid gap-1.5 text-[11px] font-semibold leading-5 text-amber-900">
                {plan.risks.slice(0, 4).map(risk => (
                  <p key={risk}>- {risk}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-slate-200 bg-white p-4">
            <p className="text-[12px] font-bold text-slate-900">
              {locale === 'id' ? 'Langkah mulai minggu ini' : 'Steps for this week'}
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {plan.firstSteps.slice(0, 5).map((step, index) => (
                <div key={step} className="flex gap-2 text-[12px] text-slate-600">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[11px] font-bold text-emerald-700">
                    {index + 1}
                  </span>
                  <span className="leading-5">{step}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {plan.searchQueries.slice(0, 5).map(query => (
                <Link
                  key={query}
                  href={searchHref(query)}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  <Search className="h-3.5 w-3.5" />
                  {query}
                </Link>
              ))}
              <Link
                href={demandHref}
                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-slate-900 px-3 text-[11px] font-bold text-white"
              >
                {locale === 'id' ? 'Posting kebutuhan' : 'Post need'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
