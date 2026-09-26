'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Clipboard,
  Loader2,
  MapPin,
  Sparkles,
  X,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';

type ProfileDraft = {
  headline: string;
  bio: string;
  business_name: string;
  services: string[];
  expertise: string[];
  location: string;
  contact_cta: string;
  keywords: string[];
  missing_fields: string[];
  trust_notes: string[];
  confidence: number | null;
};

type ProfileAiListing = {
  title?: string | null;
  content_type?: string | null;
  category?: string | null;
  summary?: string | null;
  location?: string | null;
};

type Props = {
  open: boolean;
  detail: {
    id: string;
    full_name?: string | null;
    fullName?: string | null;
    username?: string | null;
    bio?: string | null;
    location?: string | null;
    metadata?: Record<string, unknown> | null;
    provider_profile?: unknown;
    freelancer_profile?: unknown;
    buyer_profile?: unknown;
  } | null;
  listings: ProfileAiListing[];
  isId: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

function readRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readText(value: unknown, maxLength = 220) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function listText(value: unknown, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => readText(item, 180))
    .filter(Boolean)
    .slice(0, limit);
}

export function ProfileAiDraftModal({
  open,
  detail,
  listings,
  isId,
  onClose,
  onSaved,
}: Props) {
  const { authFetch, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

  const profileContext = useMemo(() => {
    const metadata = readRecord(detail?.metadata);
    const provider = readRecord(detail?.provider_profile);
    const freelancer = readRecord(detail?.freelancer_profile);
    const buyer = readRecord(detail?.buyer_profile);

    return {
      full_name: readText(detail?.full_name || detail?.fullName, 140),
      username: readText(detail?.username, 100),
      bio: readText(detail?.bio, 900),
      location: readText(detail?.location, 180),
      metadata: {
        category: readText(
          metadata.category ||
            metadata.business_category ||
            provider.category ||
            provider.business_category ||
            freelancer.category,
          140,
        ),
        roles: listText(metadata.roles, 16),
        skills: listText(
          provider.skills ||
            freelancer.skills ||
            metadata.skills,
          20,
        ),
        service_coverage: listText(
          provider.service_coverage ||
            provider.serviceCoverage ||
            metadata.service_coverage,
          12,
        ),
        work_mode: readText(provider.work_mode || metadata.work_mode, 100),
        buyer_intent: readText(
          buyer.intent || buyer.buyer_intent || metadata.buyer_intent,
          320,
        ),
      },
    };
  }, [detail]);

  async function generate() {
    if (!detail || loading) return;
    setLoading(true);
    setError('');
    setNotice('');

    try {
      const response = await authFetch('/api/profile/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale: isId ? 'id' : 'en',
          profile: profileContext,
          listings: listings.slice(0, 20).map(item => ({
            title: item.title || '',
            type: item.content_type || '',
            category: item.category || '',
            summary: item.summary || '',
            location: item.location || '',
          })),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        data?: ProfileDraft;
        error?: string;
      };

      if (!response.ok || !payload.data) {
        throw new Error(
          payload.error ||
            (isId
              ? 'Draft profil belum berhasil dibuat.'
              : 'The profile draft could not be generated.'),
        );
      }

      setDraft({
        headline: readText(payload.data.headline, 180),
        bio: readText(payload.data.bio, 900),
        business_name: readText(payload.data.business_name, 180),
        services: listText(payload.data.services),
        expertise: listText(payload.data.expertise, 16),
        location: readText(payload.data.location, 180),
        contact_cta: readText(payload.data.contact_cta, 180),
        keywords: listText(payload.data.keywords, 20),
        missing_fields: listText(payload.data.missing_fields, 12),
        trust_notes: listText(payload.data.trust_notes, 12),
        confidence:
          typeof payload.data.confidence === 'number'
            ? payload.data.confidence
            : null,
      });
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : isId
            ? 'AI Profil gagal digunakan.'
            : 'Profile AI failed.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function applyDraft() {
    if (!detail || !draft || applying) return;
    setApplying(true);
    setError('');
    setNotice('');

    try {
      const metadata = readRecord(detail.metadata);
      const provider = readRecord(detail.provider_profile);

      const response = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bio: draft.bio || undefined,
          location: draft.location || undefined,
          provider_profile: {
            ...provider,
            headline: draft.headline || provider.headline || undefined,
            skills:
              draft.expertise.length > 0
                ? draft.expertise
                : provider.skills || undefined,
            service_coverage:
              draft.services.length > 0
                ? draft.services
                : provider.service_coverage || undefined,
          },
          metadata: {
            ...metadata,
            provider_profile: {
              ...readRecord(metadata.provider_profile),
              headline: draft.headline || provider.headline || undefined,
              skills:
                draft.expertise.length > 0
                  ? draft.expertise
                  : provider.skills || undefined,
              service_coverage:
                draft.services.length > 0
                  ? draft.services
                  : provider.service_coverage || undefined,
            },
            ai_profile_draft: {
              generated_at: new Date().toISOString(),
              keywords: draft.keywords.slice(0, 20),
            },
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            (isId ? 'Draft profil gagal diterapkan.' : 'The profile draft could not be applied.'),
        );
      }

      await refreshUser();
      await onSaved();
      setNotice(
        isId
          ? 'Profil inti sudah diperbarui dari draft AI.'
          : 'Core profile fields were updated from the AI draft.',
      );
    } catch (applyError) {
      setError(
        applyError instanceof Error
          ? applyError.message
          : isId
            ? 'Draft profil gagal diterapkan.'
            : 'The profile draft could not be applied.',
      );
    } finally {
      setApplying(false);
    }
  }

  function copyBio() {
    if (!draft?.bio) return;
    void navigator.clipboard
      .writeText(draft.bio)
      .then(() =>
        setNotice(isId ? 'Bio disalin.' : 'Bio copied.'),
      )
      .catch(() =>
        setError(isId ? 'Bio gagal disalin.' : 'Could not copy the bio.'),
      );
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1450] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={isId ? 'AI Profil' : 'Profile AI'}
        className="max-h-[92svh] w-full max-w-2xl overflow-hidden rounded-t-[28px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-2xl sm:rounded-[28px]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[color:var(--app-border)] px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-300">
                  Lajukan AI
                </p>
                <h2 className="truncate text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {isId ? 'Rapikan profil dengan AI' : 'Improve profile with AI'}
                </h2>
              </div>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
              {isId
                ? 'AI membaca profil dan etalase kamu, lalu membuat draft. Tidak ada perubahan otomatis sebelum kamu menekan Terapkan.'
                : 'AI reads your profile and storefront, then creates a grounded draft. Nothing is changed until you apply it.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isId ? 'Tutup' : 'Close'}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[72svh] overflow-y-auto p-4 sm:p-5">
          {!draft ? (
            <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4">
              <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {isId ? 'Siapkan draft profil' : 'Generate a profile draft'}
              </p>
              <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                {isId
                  ? `${listings.length} posting aktif akan ikut dibaca sebagai konteks.`
                  : `${listings.length} active posts will be used as context.`}
              </p>
              <button
                type="button"
                onClick={() => void generate()}
                disabled={loading}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm disabled:opacity-60 sm:w-auto"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                {loading
                  ? isId
                    ? 'Menyusun...'
                    : 'Generating...'
                  : isId
                    ? 'Buat draft AI'
                    : 'Generate AI draft'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--app-border)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                    {isId ? 'Headline' : 'Headline'}
                  </p>
                  <p className="mt-1 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {draft.headline || '—'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[color:var(--app-border)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                    <MapPin className="mr-1 inline h-3 w-3" />
                    {isId ? 'Lokasi' : 'Location'}
                  </p>
                  <p className="mt-1 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {draft.location || '—'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[color:var(--app-border)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                    Bio
                  </p>
                  <button
                    type="button"
                    onClick={copyBio}
                    className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[color:var(--app-surface-muted)] px-3 text-[10px] font-black"
                  >
                    <Clipboard className="h-3.5 w-3.5" />
                    {isId ? 'Salin' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {draft.bio || '—'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-[color:var(--app-border)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                    {isId ? 'Layanan' : 'Services'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(draft.services.length > 0 ? draft.services : ['—']).map(item => (
                      <span
                        key={item}
                        className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[color:var(--app-border)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                    {isId ? 'Keahlian' : 'Expertise'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(draft.expertise.length > 0 ? draft.expertise : ['—']).map(item => (
                      <span
                        key={item}
                        className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {draft.missing_fields.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-500/10 dark:text-amber-100">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em]">
                    {isId ? 'Masih kurang' : 'Still missing'}
                  </p>
                  <div className="mt-2 space-y-1">
                    {draft.missing_fields.map(item => (
                      <p key={item} className="text-xs">
                        • {item}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {draft.trust_notes.length > 0 ? (
                <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                    {isId ? 'Catatan kepercayaan' : 'Trust notes'}
                  </p>
                  <div className="mt-2 space-y-1">
                    {draft.trust_notes.map(item => (
                      <p key={item} className="text-xs leading-5 text-[color:var(--app-text-soft)]">
                        • {item}
                      </p>
                    ))}
                  </div>
                </div>
              ) : null}

              {draft.contact_cta ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-500/10 dark:text-emerald-100">
                  CTA: {draft.contact_cta}
                </div>
              ) : null}

              <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void generate()}
                  disabled={loading}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-xs font-black"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isId ? 'Buat ulang' : 'Regenerate'}
                </button>
                <button
                  type="button"
                  onClick={() => void applyDraft()}
                  disabled={applying || !draft.bio}
                  className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-black text-white shadow-sm disabled:opacity-60"
                >
                  {applying ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {applying ? (isId ? 'Menerapkan...' : 'Applying...') : isId ? 'Terapkan ke profil' : 'Apply to profile'}
                </button>
              </div>
            </div>
          )}

          {error ? (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-800 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200">
              {error}
            </div>
          ) : null}

          {notice ? (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-200">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {notice}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
