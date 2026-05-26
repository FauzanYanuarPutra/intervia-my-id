'use client';

import { Zap } from 'lucide-react';

type Props = { loading: boolean; summary: string | null };

export default function AISummaryCard({ loading, summary }: Props) {
  if (!loading && !summary) return null;
  return (
    <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] dark:text-[color:var(--app-info)]">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">AI Summary</h3>
          <p className="text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">Search intelligence preview</p>
        </div>
      </div>
      {loading ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--app-info-border)] border-t-transparent" />
            <span className="text-sm">Analyzing search results...</span>
          </div>
          <div className="space-y-2 pt-2">
            <div className="ui-skeleton ui-skeleton-pulse h-3 w-full rounded" />
            <div className="ui-skeleton ui-skeleton-pulse h-3 w-5/6 rounded" />
            <div className="ui-skeleton ui-skeleton-pulse h-3 w-4/5 rounded" />
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] sm:text-base">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
}
