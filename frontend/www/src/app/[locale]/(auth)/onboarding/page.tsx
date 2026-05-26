'use client';

import { type FormEvent, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  ChevronDown,
  Factory,
  Hammer,
  Landmark,
  LoaderCircle,
  Search,
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
      id: 'Kalau kamu lagi butuh vendor, supplier, atau partner.',
      en: 'Vendors, suppliers, or partners.',
    },
  },
  {
    value: 'seller',
    icon: Store,
    label: { id: 'Jual barang atau jasa', en: 'Sell goods or services' },
    hint: {
      id: 'Kalau kamu mau pasang produk, jasa, atau stok.',
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
    Number(!fullName.trim()) +
    Number(roles.length === 0);
  const completionPercent = ((2 - remainingRequired) / 2) * 100;
  const roleSummary = summarizeSelections(
    ROLE_OPTIONS,
    roles,
    isId,
    isId ? 'Belum dipilih' : 'Not selected yet',
  );
  const sectorSummary = summarizeSelections(
    SECTOR_OPTIONS,
    sectors,
    isId,
    isId ? 'Belum dipilih' : 'Not selected yet',
  );
  const requiredStatusItems = [
    {
      label: isId ? 'Nama kamu' : 'Your name',
      done: Boolean(fullName.trim()),
      value: fullName.trim() || (isId ? 'Belum diisi' : 'Not filled yet'),
    },
    {
      label: isId ? 'Tujuan pakai' : 'Main purpose',
      done: roles.length > 0,
      value: roleSummary,
    },
  ];
  const fieldClass =
    'ui-control min-h-[56px] w-full rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-sm text-[color:var(--app-text)]';
  const sectionClass =
    'rounded-[28px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,white_6%)] p-5 shadow-[0_20px_44px_-36px_rgba(15,23,42,0.2)] sm:p-6';

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
    <div className="min-h-svh bg-[linear-gradient(180deg,#f7f3ea_0%,#eef5ff_100%)] px-4 py-4 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-6xl">
        <section className="ui-hero-panel rounded-[30px] border border-[color:color-mix(in_srgb,var(--app-accent)_18%,var(--app-border))] p-4 shadow-[0_24px_56px_-40px_rgba(15,23,42,0.24)] sm:p-5 lg:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex min-h-[32px] items-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_70%,white_30%)] px-3.5 text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                  {isId ? 'Langkah awal' : 'First steps'}
                </span>
                <span className="inline-flex min-h-[32px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_86%,white_14%)] px-3.5 text-[11px] font-semibold text-[color:var(--app-text)]">
                  {remainingRequired === 0
                    ? isId
                      ? 'Siap lanjut'
                      : 'Ready to continue'
                    : isId
                      ? `Langkah ${Math.max(1, 3 - remainingRequired)} dari 2`
                      : `Step ${Math.max(1, 3 - remainingRequired)} of 2`}
                </span>
              </div>

              <h1 className="mt-3 max-w-2xl text-[1.8rem] font-black tracking-[-0.06em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[2.15rem]">
                {isId ? 'Lengkapi akun kamu' : 'Complete your account'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)] sm:text-[15px]">
                {isId
                  ? 'Isi nama dan pilih tujuan utama dulu. Detail usaha bisa nanti.'
                  : 'Name and main purpose first. Business details can wait.'}
              </p>
            </div>

            <div className="w-full max-w-[340px] rounded-[26px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_88%,white_12%)] p-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {isId ? 'Yang wajib dulu' : 'Required first'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                    {remainingRequired === 0
                      ? isId
                        ? 'Dua hal wajib sudah siap.'
                        : 'Everything required is ready.'
                      : isId
                        ? `Sisa ${remainingRequired} lagi.`
                        : `${remainingRequired} more to go.`}
                  </p>
                </div>
                <span className="rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_74%,white_26%)] px-3 py-1 text-xs font-bold text-[color:var(--app-accent)]">
                  {Math.round(Math.max(completionPercent, 8))}%
                </span>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[color:var(--app-surface)]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent-strong))] transition-[width] duration-300"
                  style={{ width: `${Math.max(completionPercent, 8)}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                {requiredStatusItems.map(item => (
                  <div
                    key={item.label}
                    className={`rounded-2xl border px-3 py-3 text-center ${
                      item.done
                        ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                        : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                    }`}
                  >
                    <p className="font-semibold">{item.label}</p>
                    <p className="mt-1 text-[11px]">
                      {item.done
                        ? isId
                          ? 'Siap'
                          : 'Done'
                        : isId
                          ? 'Belum'
                          : 'Pending'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]"
        >
          <div className="space-y-4">
            <section className={sectionClass}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {isId ? 'Langkah 1' : 'Step 1'}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                    {isId ? 'Siapa nama kamu?' : 'What is your name?'}
                  </h2>
                </div>
                <span className="inline-flex min-h-[34px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3.5 text-xs font-semibold text-[color:var(--app-text-soft)]">
                  {remainingRequired === 0
                    ? isId
                      ? 'Semua wajib terisi'
                      : 'All required items filled'
                    : isId
                      ? `${remainingRequired} belum lengkap`
                      : `${remainingRequired} not complete yet`}
                </span>
              </div>

              <div className="mt-5 grid gap-2">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-[color:var(--app-text)]">
                    {isId ? 'Nama lengkap' : 'Full name'} *
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={event => setFullName(event.target.value)}
                    placeholder={
                      isId ? 'Contoh: Fauzan Rahman' : 'Example: Alex Morgan'
                    }
                    className={`${fieldClass} py-3`}
                  />
                </label>
              </div>
            </section>

            <section className={sectionClass}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {isId ? 'Langkah 2' : 'Step 2'}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                    {isId
                      ? 'Kamu mau pakai Lajukan buat apa?'
                      : 'What do you want to use Lajukan for?'}
                  </h2>
                </div>
                <span className="text-xs font-medium text-[color:var(--app-text-soft)]">
                  {isId ? 'Pilih minimal 1' : 'Pick at least 1'}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {ROLE_OPTIONS.map(option => {
                  const Icon = option.icon;
                  const selected = roles.includes(option.value);

                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setRoles(current => toggleValue(current, option.value))
                      }
                      className={`group flex min-h-[148px] w-full flex-col items-start rounded-[24px] border p-4 text-left transition ${
                        selected
                          ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_66%,white_34%)] shadow-[0_18px_36px_-28px_color-mix(in_srgb,var(--app-accent)_36%,transparent)]'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface)]'
                      }`}
                    >
                      <span
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                          selected
                            ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                            : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <p className="mt-4 text-sm font-semibold text-[color:var(--app-text)]">
                        {copy(option.label, isId)}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-[color:var(--app-text-soft)]">
                        {copy(option.hint, isId)}
                      </p>
                      <span
                        className={`mt-auto inline-flex min-h-[32px] items-center rounded-full px-3 text-xs font-semibold ${
                          selected
                            ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                            : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]'
                        }`}
                      >
                        {selected
                          ? isId
                            ? 'Dipilih'
                            : 'Selected'
                          : isId
                            ? 'Pilih'
                            : 'Select'}
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
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {isId ? 'Tambahan' : 'Optional extras'}
                  </p>
                  <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                    {isId ? 'Tambahan kalau mau' : 'Add more if you want'}
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
                    {sectors.length > 0
                      ? sectorSummary
                      : isId
                        ? 'Boleh nanti. Fokus dulu ke nama dan tujuan pakai.'
                        : 'Can wait. Focus on your name and role first.'}
                  </p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]">
                  <ChevronDown
                    className={`h-5 w-5 transition-transform ${
                      showOptional ? 'rotate-180' : ''
                    }`}
                  />
                </span>
              </button>

              {showOptional ? (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[color:var(--app-text)]">
                        {isId ? 'Bidang usaha' : 'Sector'}
                      </span>
                      <span className="text-xs text-[color:var(--app-text-soft)]">
                        {isId ? 'Opsional' : 'Optional'}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
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
                            className={`group flex min-h-[104px] w-full items-start gap-3 rounded-[22px] border p-4 text-left transition ${
                              selected
                                ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_66%,white_34%)] shadow-[0_18px_34px_-28px_color-mix(in_srgb,var(--app-accent)_34%,transparent)]'
                                : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-surface)]'
                            }`}
                          >
                            <span
                              className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                                selected
                                  ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                                  : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]'
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-[color:var(--app-text)]">
                                {copy(option.label, isId)}
                              </span>
                              <span className="mt-1 block text-sm leading-5 text-[color:var(--app-text-soft)]">
                                {copy(option.hint, isId)}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Nama usaha' : 'Company name'}
                    </span>
                    <input
                      type="text"
                      value={company}
                      onChange={event => setCompany(event.target.value)}
                      placeholder={
                        isId ? 'Contoh: Toko Berkah Jaya' : 'Example: Northstar Labs'
                      }
                      className={`${fieldClass} py-3`}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-[color:var(--app-text)]">
                      {isId ? 'Deskripsi singkat' : 'Short description'}
                    </span>
                    <textarea
                      value={bio}
                      onChange={event => setBio(event.target.value)}
                      placeholder={
                        isId
                          ? 'Contoh: Jual frozen food rumahan area Depok.'
                          : 'Example: chicken supplier, design service, or marketplace admin.'
                      }
                      rows={4}
                      className={`${fieldClass} min-h-[120px] py-3`}
                    />
                  </label>
                </div>
              ) : null}
            </section>

            {error ? (
              <div className="rounded-[24px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-4 py-3 text-sm font-medium text-[color:var(--app-danger)]">
                {error}
              </div>
            ) : null}
          </div>

          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className={sectionClass}>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {isId ? 'Sebelum lanjut' : 'Before you continue'}
              </p>
              <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-[color:var(--app-text)]">
                {remainingRequired === 0
                  ? isId
                    ? 'Siap lanjut'
                    : 'Ready to continue'
                  : isId
                    ? `${remainingRequired} wajib lagi`
                    : `${remainingRequired} required left`}
              </h2>

              <div className="mt-5 space-y-3">
                {requiredStatusItems.map(item => (
                  <div
                    key={item.label}
                    className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl ${
                          item.done
                            ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                            : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]'
                        }`}
                      >
                        {item.done ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <span className="text-xs font-bold">..</span>
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-[color:var(--app-text)]">
                          {item.label}
                        </span>
                        <span className="mt-1 block text-sm leading-5 text-[color:var(--app-text-soft)]">
                          {item.value}
                        </span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="ui-button-primary mt-5 inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[20px] px-5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    {isId ? 'Menyimpan...' : 'Saving...'}
                  </>
                ) : (
                  <>
                    {isId ? 'Lanjut' : 'Continue'}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>

              <Link
                href="/dashboard"
                className="ui-button-secondary mt-3 inline-flex min-h-[50px] w-full items-center justify-center rounded-[20px] px-4 text-sm font-semibold"
              >
                {isId ? 'Lewati dulu' : 'Skip for now'}
              </Link>
            </div>
          </aside>
        </form>
      </div>
    </div>
  );
}
