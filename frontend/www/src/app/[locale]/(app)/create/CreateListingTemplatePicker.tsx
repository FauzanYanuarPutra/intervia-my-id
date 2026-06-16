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
    <details className="group rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-2 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_68%,_transparent)]">
      <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] px-1 text-left [&::-webkit-details-marker]:hidden">
        <span className="inline-flex min-w-0 items-center gap-2">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {isId ? 'Contoh cepat' : 'Quick examples'}
            </span>
            <span className="block truncate text-[10px] font-medium text-[color:var(--app-text-soft)]">
              {isId ? 'Buka kalau butuh inspirasi.' : 'Open only if you need a starter.'}
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-black text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
          {templates.length} {isId ? 'opsi' : 'options'}
        </span>
      </summary>

      <div className="relative mt-2 grid gap-1.5">
        {templates.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => onApplyTemplate(template.id)}
            className="group/template relative overflow-hidden rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-left shadow-[0_12px_22px_-18px_rgba(15,23,42,0.12)] transition hover:-translate-y-0.5 hover:border-teal-200 hover:bg-teal-50/85 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/68 dark:hover:border-teal-800 dark:hover:bg-teal-950/20"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-current/10 bg-slate-100/90 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  {template.badge}
                </span>
                <p className="mt-1 text-[12px] font-semibold leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {template.title}
                </p>
                <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                  {template.summary}
                </p>
              </div>
              <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-black text-slate-700 transition group-hover/template:scale-105 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
                <Wand2 className="h-3 w-3" />
                {isId ? 'Pakai' : 'Use'}
              </span>
            </div>
          </button>
        ))}
      </div>
    </details>
  );
}
