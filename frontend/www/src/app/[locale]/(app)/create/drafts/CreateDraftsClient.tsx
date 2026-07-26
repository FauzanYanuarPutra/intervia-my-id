'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowRight, Clock3, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  clearTemporaryCreateDraft,
  readTemporaryCreateDraft,
  type TemporaryCreateDraft,
} from '@/lib/create/createDraftStorage';

type ServerDraft = {
  id: string;
  title?: string;
  listing_intent?: 'offer' | 'request';
  category_slug?: string;
  subcategory_slug?: string;
  current_step?: number;
  completion_percentage?: number;
  last_saved_at?: string;
  updated_at?: string;
};

function label(locale: 'id' | 'en', id: string, en: string) {
  return locale === 'id' ? id : en;
}

function categoryLabel(slug?: string) {
  return (
    {
      'materials-suppliers': 'Bahan & Supplier',
      services: 'Cari Jasa',
      'machines-tools': 'Mesin & Alat',
      'business-places': 'Tempat Usaha',
      'business-opportunities': 'Peluang Usaha',
    }[slug || ''] || 'Marketplace'
  );
}

function draftCategorySlug(draft: ServerDraft | TemporaryCreateDraft) {
  return 'draftStorageVersion' in draft
    ? draft.categorySlug
    : draft.category_slug;
}

function draftTitle(draft: ServerDraft | TemporaryCreateDraft) {
  const values =
    'formValues' in draft
      ? draft.formValues
      : (draft as { values?: Record<string, unknown> }).values || {};
  const title =
    ('title' in draft ? draft.title : undefined) ||
    (typeof values.title === 'string' ? values.title : '') ||
    (typeof values.item_name === 'string' ? values.item_name : '') ||
    (typeof values.item_needed === 'string' ? values.item_needed : '');
  if (title && !title.toLowerCase().startsWith('draft ')) return title;
  return `Draft ${categoryLabel(draftCategorySlug(draft))}`;
}

export default function CreateDraftsClient() {
  const params = useParams<{ locale?: string }>();
  const locale = params?.locale === 'en' ? 'en' : 'id';
  const router = useRouter();
  const { authFetch, isAuthenticated } = useAuth();
  const [localDraft, setLocalDraft] = useState<TemporaryCreateDraft | null>(
    () => readTemporaryCreateDraft(),
  );
  const [serverDrafts, setServerDrafts] = useState<ServerDraft[]>([]);

  useEffect(() => {
    if (!isAuthenticated) return;
    authFetch('/api/listing-drafts?limit=40', { cache: 'no-store' })
      .then(res => res.json())
      .then(data =>
        setServerDrafts(Array.isArray(data.items) ? data.items : []),
      )
      .catch(() => setServerDrafts([]));
  }, [authFetch, isAuthenticated]);

  const hasDrafts = Boolean(localDraft) || serverDrafts.length > 0;
  const items = useMemo(
    () => [
      ...(localDraft ? [{ kind: 'local' as const, draft: localDraft }] : []),
      ...serverDrafts.map(draft => ({ kind: 'server' as const, draft })),
    ],
    [localDraft, serverDrafts],
  );

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 text-slate-950 dark:text-slate-50">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold tracking-normal">
          {label(locale, 'Draft postingan', 'Posting drafts')}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {label(
            locale,
            'Kamu bisa melanjutkan draft tanpa kehilangan data.',
            'You can continue drafts without losing data.',
          )}
        </p>

        {!hasDrafts ? (
          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold">
              {label(locale, 'Belum ada draft.', 'No drafts yet.')}
            </p>
            <button
              type="button"
              onClick={() => router.push(`/${locale}/create`)}
              className="mt-4 min-h-[44px] rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white"
            >
              {label(locale, 'Mulai postingan baru', 'Start a new post')}
            </button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {items.map(({ kind, draft }, index) => {
              const category = draftCategorySlug(draft);
              const step =
                'currentStep' in draft
                  ? draft.currentStep
                  : draft.current_step || 1;
              const updated =
                'updatedAt' in draft
                  ? draft.updatedAt
                  : draft.last_saved_at || draft.updated_at;
              return (
                <article
                  key={`${kind}-${'id' in draft ? draft.id : draft.idempotencyKey}-${index}`}
                  className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-bold">{draftTitle(draft)}</h2>
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {categoryLabel(category)} ·{' '}
                        {label(locale, 'Langkah terakhir', 'Last step')}: {step}
                      </p>
                      {updated ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {label(locale, 'Tersimpan', 'Saved')}{' '}
                          {new Date(updated).toLocaleString(
                            locale === 'id' ? 'id-ID' : 'en-US',
                          )}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      {kind === 'local' ? (
                        <button
                          type="button"
                          onClick={() => {
                            clearTemporaryCreateDraft();
                            setLocalDraft(null);
                          }}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          {label(locale, 'Hapus', 'Delete')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => router.push(`/${locale}/create`)}
                        className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-bold text-white"
                      >
                        {label(locale, 'Lanjutkan', 'Continue')}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
