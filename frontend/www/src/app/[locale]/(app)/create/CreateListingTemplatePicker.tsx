'use client';

import { Sparkles, Wand2 } from 'lucide-react';
import type { ListingSide } from '@/lib/content/listingSide';
import type { ListingTypeId } from './createPageUtils';
import { getListingTemplates } from '@/lib/content/listingTemplates';

type Props = {
  locale: string;
  listingSide: ListingSide;
  activeType: ListingTypeId;
  onApplyTemplate: (templateId: string) => void;
};

export function CreateListingTemplatePicker({
  locale,
  listingSide,
  activeType,
  onApplyTemplate,
}: Props) {
  const templates = getListingTemplates(locale, listingSide, activeType);
  const isId = locale === 'id';

  if (templates.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_68%,_transparent)]">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
            {isId ? 'Butuh contoh?' : 'Need a starter?'}
          </p>
          <p className="mt-2 text-[13px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {isId
              ? 'Pilih contoh yang paling mirip, lalu ganti seperlunya.'
              : 'Pick the closest example, then edit what matters.'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[9px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]">
              {templates.length} {isId ? 'opsi' : 'options'}
            </span>
            <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-1 text-[9px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
              {isId ? 'Klik buat isi otomatis' : 'Tap to fill'}
            </span>
          </div>
        </div>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="relative mt-2.5 grid gap-1.5">
        {templates.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => onApplyTemplate(template.id)}
            className="group relative overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-left shadow-[0_12px_22px_-18px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/85 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/68 dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-current/10 bg-slate-100/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {template.badge}
                </span>
                <p className="mt-1.5 text-[12px] font-semibold leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {template.title}
                </p>
                <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                  {template.summary}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                    {isId ? 'Pakai contoh' : 'Use sample'}
                  </span>
                  <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
                    {isId ? 'Auto isi' : 'Auto-fill'}
                  </span>
                </div>
              </div>
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-slate-200 bg-slate-50 text-slate-700 transition group-hover:scale-105 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <Wand2 className="h-3 w-3" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
