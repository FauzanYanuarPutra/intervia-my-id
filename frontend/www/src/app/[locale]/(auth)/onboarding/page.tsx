'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ChevronDown,
  Factory,
  Hammer,
  Landmark,
  LoaderCircle,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';

type LocalizedText = {
  id: string;
  en: string;
};

type Choice = {
  value: string;
  icon: LucideIcon;
  label: LocalizedText;
  hint: LocalizedText;
};

const ROLE_OPTIONS: Choice[] = [
  {
    value: 'buyer',
    icon: Search,
    label: { id: 'Cari barang atau jasa', en: 'Find goods or services' },
    hint: {
      id: 'Untuk mencari vendor, supplier, atau partner.',
      en: 'Vendors, suppliers, or partners.',
    },
  },
  {
    value: 'seller',
    icon: Store,
    label: { id: 'Tawarkan barang atau jasa', en: 'Sell goods or services' },
    hint: {
      id: 'Untuk menawarkan produk, jasa, atau stok.',
      en: 'Products, services, or stock.',
    },
  },
  {
    value: 'talent',
    icon: BadgeCheck,
    label: { id: 'Tawarkan skill pribadi', en: 'Offer personal skills' },
    hint: {
      id: 'Jasa personal, freelance, skill khusus.',
      en: 'Freelance, admin, operator, specialist.',
    },
  },
];

const SECTOR_OPTIONS: Choice[] = [
  {
    value: 'technology',
    icon: Sparkles,
    label: { id: 'Teknologi', en: 'Technology' },
    hint: {
      id: 'Software dan tools digital.',
      en: 'Software and digital tools.',
    },
  },
  {
    value: 'realestate',
    icon: Building2,
    label: { id: 'Properti', en: 'Property' },
    hint: {
      id: 'Sewa, agen, dan project.',
      en: 'Rentals, agents, and projects.',
    },
  },
  {
    value: 'manufacturing',
    icon: Factory,
    label: { id: 'Produksi atau pabrik', en: 'Manufacturing' },
    hint: {
      id: 'Bahan baku, pabrik, packaging.',
      en: 'Raw materials, factories, packaging.',
    },
  },
  {
    value: 'finance',
    icon: Landmark,
    label: { id: 'Keuangan', en: 'Finance' },
    hint: {
      id: 'Pembiayaan dan akuntansi.',
      en: 'Funding and accounting.',
    },
  },
  {
    value: 'construction',
    icon: Hammer,
    label: { id: 'Konstruksi', en: 'Construction' },
    hint: {
      id: 'Project lapangan dan material.',
      en: 'Field projects and materials.',
    },
  },
  {
    value: 'retail',
    icon: ShoppingBag,
    label: { id: 'Retail atau e-commerce', en: 'Retail or e-commerce' },
    hint: {
      id: 'Toko, reseller, live commerce.',
      en: 'Stores, resellers, live commerce.',
    },
  },
];

function copy(text: LocalizedText, isId: boolean) {
  return isId ? text.id : text.en;
}

function toggleValue(values: string[], value: string) {
  if (values.includes(value)) {
    return values.filter(item => item !== value);
  }

  return [...values, value];
}

function summarizeSelections(
  options: Choice[],
  values: string[],
  isId: boolean,
  emptyLabel: string,
) {
  if (values.length === 0) return emptyLabel;

  const labels = options
    .filter(option => values.includes(option.value))
    .map(option => copy(option.label, isId));

  return labels.join(', ');
}

export default function OnboardingPage() {
  const locale = useLocale();
  const isId = locale === 'id';
  const router = useRouter();
  const { user, authFetch, loading: authLoading, refreshUser } = useAuth();

  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [bio, setBio] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [sectors, setSectors] = useState<string[]>([]);
  const [showOptional, setShowOptional] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
    }
  }, [authLoading, router, user]);

  useEffect(() => {
    if (!user) return;

    const initialName = user.full_name || user.fullName || '';
    if (initialName) {
      setFullName(current => current || initialName);
    }
  }, [user]);

  const remainingRequired =
    Number(!fullName.trim()) + Number(roles.length === 0);
  const readyToContinue = remainingRequired === 0;
  const completionPercent = ((2 - remainingRequired) / 2) * 100;
  const primaryActionLabel = readyToContinue
    ? isId
      ? 'Lanjut'
      : 'Continue'
    : isId
      ? 'Lengkapi dulu'
      : 'Complete first';
  const primaryActionHint = readyToContinue
    ? isId
      ? 'Profil dasar siap. Lanjut ke dashboard.'
      : 'Basic profile is ready. Continue to dashboard.'
    : isId
      ? `${remainingRequired} bagian wajib belum diisi.`
      : `${remainingRequired} required item${remainingRequired > 1 ? 's' : ''} left.`;
  const sectorSummary = summarizeSelections(
    SECTOR_OPTIONS,
    sectors,
    isId,
    isId ? 'Belum dipilih' : 'Not selected yet',
  );
  const fieldClass =
    'ui-control min-h-[44px] w-full rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 text-sm text-[color:var(--app-text)] outline-none focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]';
  const sectionClass =
    'rounded-[20px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,white_6%)] p-3.5 shadow-[0_18px_42px_-38px_rgba(15,23,42,0.28)] sm:p-4';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!fullName.trim() || roles.length === 0) {
      setError(
        isId
          ? 'Isi nama dan pilih minimal satu peran.'
          : 'Enter your name and choose at least one role.',
      );
      return;
    }

    setLoading(true);
    setError('');

    try {
      const profilePayload = {
        roles,
        sectors,
        full_name: fullName.trim(),
        company: company.trim() || undefined,
        bio: bio.trim() || undefined,
      };

      const onboardingRes = await authFetch('/api/auth/onboarding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: 'completed',
          roles,
          profile: profilePayload,
        }),
      });

      if (!onboardingRes.ok) {
        const fallbackRes = await authFetch('/api/auth/update-profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            roles,
            onboarding_step: 'completed',
            bio: bio.trim() || undefined,
            profile: profilePayload,
          }),
        });

        if (!fallbackRes.ok) {
          throw new Error('Failed to save onboarding');
        }
      }

      try {
        await refreshUser();
      } catch {
        // Keep navigation moving even if the refresh is slow or fails.
      }

      router.push('/dashboard');
      router.refresh();
    } catch (submitError) {
      console.error(submitError);
      setError(
        isId
          ? 'Onboarding belum tersimpan. Coba lagi.'
          : 'Onboarding could not be saved. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  if (!authLoading && !user) {
    return null;
  }

  return (
    <div className="min-h-svh bg-[color:color-mix(in_srgb,var(--app-bg)_90%,var(--app-accent-soft)_10%)] px-4 py-4 text-[color:var(--app-text)] sm:px-6 sm:py-6">
      <main className="mx-auto w-full max-w-[680px]">
        <header className="mb-3 flex items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex min-h-9 items-center rounded-full px-3 text-sm font-semibold text-[color:var(--app-text-soft)]"
          >
            {isId ? 'Lewati' : 'Skip'}
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[color:var(--app-accent)]">
              {Math.round(completionPercent)}%
            </span>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
              <div
                className="h-full rounded-full bg-[color:var(--app-accent)] transition-[width] duration-300"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </header>

        <div className="mb-4 rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-accent)_16%,var(--app-border))] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_20px_54px_-42px_rgba(15,23,42,0.38)]">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
            {isId ? 'Mulai cepat' : 'Quick setup'}
          </p>
          <h1 className="mt-2 text-[1.65rem] font-bold leading-[1.04] tracking-[-0.045em] text-[color:var(--app-text)] sm:text-[2rem]">
            {isId
              ? 'Bikin Lajukan langsung ngerti kebutuhanmu.'
              : 'Help Lajukan understand your needs.'}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Cukup nama dan tujuan utama. Detail usaha bisa nanti, biar tidak pusing di awal.'
              : 'Just your name and main purpose. Business details can wait.'}
          </p>
          <div className="mt-3 flex items-start gap-2 rounded-[16px] bg-[color:var(--app-accent-soft)] px-3 py-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent-strong)]" />
            <p className="text-[11px] font-bold leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Username bisa dilihat orang. Jangan pakai nama, brand, atau username sebagai password.'
                : 'Usernames can be visible. Do not use your name, brand, or username as your password.'}
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-2.5 pb-[calc(9rem+env(safe-area-inset-bottom))]"
        >
          <section className={sectionClass}>
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent)] text-sm font-bold text-[color:var(--app-text-inverse)]">
                1
              </span>
              <label className="grid min-w-0 flex-1 gap-2">
                <span className="text-base font-bold tracking-[-0.02em]">
                  {isId ? 'Nama kamu' : 'Your name'}
                </span>
                <input
                  type="text"
                  value={fullName}
                  onChange={event => {
                    setFullName(event.target.value);
                    setError('');
                  }}
                  placeholder={
                    isId ? 'Contoh: Fauzan Rahman' : 'Example: Alex Morgan'
                  }
                  className={`${fieldClass} py-3`}
                />
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[color:var(--app-accent)] text-sm font-bold text-[color:var(--app-text-inverse)]">
                2
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold tracking-[-0.02em]">
                  {isId ? 'Tujuan utama' : 'Main purpose'}
                </h2>
                <p className="mt-0.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Pilih satu atau lebih.' : 'Pick one or more.'}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {ROLE_OPTIONS.map(option => {
                const Icon = option.icon;
                const selected = roles.includes(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setRoles(current => toggleValue(current, option.value));
                      setError('');
                    }}
                    className={`flex min-h-[78px] items-start gap-2.5 rounded-[17px] border p-3 text-left transition active:scale-[0.99] ${selected
                        ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                        : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent-border)]'
                      }`}
                  >
                    <span
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-[13px] ${selected
                          ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                          : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                        }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-5">
                        {copy(option.label, isId)}
                      </span>
                      <span className="mt-1 block text-xs font-medium leading-4 text-[color:var(--app-text-soft)]">
                        {copy(option.hint, isId)}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className={sectionClass}>
            <button
              type="button"
              onClick={() => setShowOptional(current => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold">
                  {isId ? 'Profil usaha opsional' : 'Optional business profile'}
                </span>
                <span className="mt-1 block truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {sectors.length > 0 || company.trim()
                    ? [sectorSummary, company.trim()].filter(Boolean).join(' / ')
                    : isId
                      ? 'Buka kalau mau isi bidang, nama usaha, atau bio.'
                      : 'Open to add sector, company, or bio.'}
                </span>
              </span>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--app-surface-muted)]">
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${showOptional ? 'rotate-180' : ''
                    }`}
                />
              </span>
            </button>

            {showOptional ? (
              <div className="mt-4 space-y-4 border-t border-[color:var(--app-border)] pt-4">
                <div>
                  <p className="text-sm font-bold">
                    {isId ? 'Bidang usaha' : 'Sector'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {SECTOR_OPTIONS.map(option => {
                      const Icon = option.icon;
                      const selected = sectors.includes(option.value);

                      return (
                        <button
                          key={option.value}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            setSectors(current =>
                              toggleValue(current, option.value),
                            )
                          }
                          className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3 text-xs font-bold transition ${selected
                              ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                              : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'
                            }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          {copy(option.label, isId)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm font-bold">
                      {isId ? 'Nama usaha' : 'Company name'}
                    </span>
                    <input
                      type="text"
                      value={company}
                      onChange={event => setCompany(event.target.value)}
                      placeholder={
                        isId
                          ? 'Contoh: Toko Berkah Jaya'
                          : 'Example: Northstar Labs'
                      }
                      className={`${fieldClass} py-3`}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-bold">
                      {isId ? 'Bio singkat' : 'Short bio'}
                    </span>
                    <textarea
                      value={bio}
                      onChange={event => setBio(event.target.value)}
                      placeholder={
                        isId
                          ? 'Contoh: Frozen food rumahan area Depok.'
                          : 'Example: chicken supplier or design service.'
                      }
                      rows={3}
                      className={`${fieldClass} min-h-[96px] py-3 sm:min-h-[46px]`}
                    />
                  </label>
                </div>
              </div>
            ) : null}
          </section>

          {error ? (
            <div className="rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm font-semibold text-[color:var(--app-danger)]">
              {error}
            </div>
          ) : null}

          <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-[120] mx-auto max-w-[680px] rounded-[24px] border border-[color:color-mix(in_srgb,var(--app-accent)_20%,var(--app-border))] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] p-2 shadow-[0_22px_64px_-34px_rgba(15,23,42,0.48)]  sm:inset-x-6 sm:p-2.5">
            <div className="mb-2 flex items-center justify-between gap-3 px-1.5">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[color:var(--app-text)]">
                  {isId ? 'Siap mulai?' : 'Ready to start?'}
                </p>
                <p className="truncate text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {primaryActionHint}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--app-accent-strong)]">
                {Math.round(completionPercent)}%
              </span>
            </div>
            <div className="flex gap-2">
              <Link
                href="/dashboard"
                className="inline-flex min-h-[50px] w-[34%] items-center justify-center rounded-[17px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-sm font-bold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-strong)]"
              >
                {isId ? 'Lewati' : 'Skip'}
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="ui-button-primary inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-[17px] px-4 text-sm font-bold shadow-[0_18px_36px_-24px_rgba(22,163,74,0.86)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {isId ? 'Menyimpan' : 'Saving'}
                  </>
                ) : (
                  <>
                    {primaryActionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
