'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  RefreshCcw,
  Search,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import type { AICreationDraft } from '@/lib/creation-drafts/types';
import { cn } from '@/lib/utils';

type AICreationCardProps = {
  draft: AICreationDraft;
  locale: 'id' | 'en';
  onImprove?: (draft: AICreationDraft) => void;
  onDiscard?: (draft: AICreationDraft) => void;
  discarding?: boolean;
};

const FIELD_LABELS_ID: Record<string, string> = {
  businessCategoryConfirmation: 'Konfirmasi kategori usaha',
  businessName: 'Nama usaha',
  businessPhoto: 'Foto usaha',
  location: 'Lokasi',
  locationConfirmation: 'Konfirmasi lokasi',
  price: 'Harga',
  quantity: 'Jumlah',
};

function readableField(value: string, locale: 'id' | 'en') {
  if (locale === 'id' && FIELD_LABELS_ID[value]) return FIELD_LABELS_ID[value];
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, letter => letter.toUpperCase());
}

function targetVisual(target: AICreationDraft['target'], locale: 'id' | 'en') {
  if (target === 'looking_for_listing') {
    return {
      Icon: Search,
      eyebrow: locale === 'id' ? 'Draft kebutuhan' : 'Request draft',
      action: locale === 'id' ? 'Lanjutkan Buat Kebutuhan' : 'Continue Request',
      accent: 'text-[#1d4ed8]',
      badge: 'bg-[#eff6ff] text-[#1d4ed8] ring-[#bfdbfe]',
      button: 'bg-[#2563eb] hover:bg-[#1d4ed8]',
      bar: 'bg-[#2563eb]',
    };
  }
  if (target === 'business_profile') {
    return {
      Icon: Building2,
      eyebrow: locale === 'id' ? 'Draft profil usaha' : 'Business profile draft',
      action: locale === 'id' ? 'Lanjutkan Daftarkan Usaha' : 'Continue Business Setup',
      accent: 'text-[#a16207]',
      badge: 'bg-[#fffbeb] text-[#a16207] ring-[#fde68a]',
      button: 'bg-[#b45309] hover:bg-[#92400e]',
      bar: 'bg-[#b45309]',
    };
  }
  return {
    Icon: ShoppingBag,
    eyebrow: locale === 'id' ? 'Draft penawaran' : 'Offer draft',
    action: locale === 'id' ? 'Lanjutkan Buat Penawaran' : 'Continue Offer',
    accent: 'text-[#047857]',
    badge: 'bg-[#ecfdf5] text-[#047857] ring-[#a7f3d0]',
    button: 'bg-[#059669] hover:bg-[#047857]',
    bar: 'bg-[#059669]',
  };
}

export function AICreationCard({
  draft,
  locale,
  onImprove,
  onDiscard,
  discarding = false,
}: AICreationCardProps) {
  const visual = targetVisual(draft.target, locale);
  const preview = draft.media.find(item => item.type === 'image' && item.url);
  const missing = draft.missingRequiredFields.slice(0, 4);
  const canContinue =
    Boolean(draft.continueUrl) &&
    draft.status !== 'expired' &&
    draft.status !== 'discarded' &&
    draft.status !== 'consumed';

  return (
    <article className="mt-2 w-full max-w-xl overflow-hidden rounded-lg border border-black/10 bg-white text-[#17202a] shadow-[0_18px_40px_-32px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-[#18242b] dark:text-[#e9edef]">
      <div className="flex items-center justify-between gap-3 border-b border-black/5 px-3 py-2.5 dark:border-white/8">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1',
              visual.badge,
            )}
          >
            <visual.Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className={cn('text-[10px] font-bold uppercase', visual.accent)}>
              {visual.eyebrow}
            </p>
            <p className="truncate text-xs font-semibold opacity-65">
              {locale === 'id' ? 'Tersimpan otomatis' : 'Saved automatically'}
            </p>
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold tabular-nums">
          {draft.completenessScore}%
        </span>
      </div>

      {preview?.url ? (
        <div className="aspect-[16/7] overflow-hidden bg-[#f3f4f6] dark:bg-[#10181d]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview.url}
            alt={preview.altText || draft.title}
            className="h-full w-full object-cover"
          />
        </div>
      ) : null}

      <div className="p-3">
        <h3 className="text-base font-bold leading-6">{draft.title}</h3>
        {draft.summary ? (
          <p className="mt-1 line-clamp-3 text-xs leading-5 opacity-72">
            {draft.summary}
          </p>
        ) : null}

        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e5e7eb] dark:bg-white/10">
          <div
            className={cn('h-full rounded-full transition-[width]', visual.bar)}
            style={{ width: `${Math.max(0, Math.min(100, draft.completenessScore))}%` }}
          />
        </div>

        {missing.length > 0 ? (
          <div className="mt-3 rounded-md bg-[#f8fafc] px-3 py-2 ring-1 ring-[#e2e8f0] dark:bg-white/5 dark:ring-white/10">
            <p className="flex items-center gap-1.5 text-[11px] font-bold">
              <CircleAlert className="h-3.5 w-3.5 text-[#d97706]" />
              {locale === 'id' ? 'Masih perlu dilengkapi' : 'Still needs details'}
            </p>
            <p className="mt-1 text-[11px] leading-5 opacity-70">
              {missing.map(field => readableField(field, locale)).join(' / ')}
            </p>
          </div>
        ) : (
          <p className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#047857]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {locale === 'id' ? 'Data utama sudah siap diperiksa' : 'Main details are ready to review'}
          </p>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          {canContinue ? (
            <Link
              href={draft.continueUrl!}
              className={cn(
                'inline-flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-center text-xs font-bold text-white transition',
                visual.button,
              )}
            >
              <span>{visual.action}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#e5e7eb] px-3 text-xs font-bold opacity-70 dark:bg-white/10">
              {draft.status === 'consumed'
                ? locale === 'id'
                  ? 'Sudah digunakan'
                  : 'Already used'
                : locale === 'id'
                  ? 'Draft tidak aktif'
                  : 'Draft inactive'}
            </span>
          )}
          <button
            type="button"
            onClick={() => onImprove?.(draft)}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#f3f4f6] px-3 text-xs font-bold text-[#374151] hover:bg-[#e5e7eb] dark:bg-white/10 dark:text-[#e9edef] dark:hover:bg-white/15"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>{locale === 'id' ? 'Perbaiki' : 'Improve'}</span>
          </button>
          <button
            type="button"
            onClick={() => onDiscard?.(draft)}
            disabled={discarding}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[#b91c1c] hover:bg-[#fef2f2] disabled:opacity-50 dark:text-[#fca5a5] dark:hover:bg-white/10"
            aria-label={locale === 'id' ? 'Hapus draft' : 'Delete draft'}
            title={locale === 'id' ? 'Hapus draft' : 'Delete draft'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
