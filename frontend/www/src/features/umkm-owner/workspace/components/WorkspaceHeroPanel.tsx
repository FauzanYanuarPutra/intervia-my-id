'use client';

import { Store } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/super-app/manage/UmkmManagePrimitives';
import type {
  UsahaFlowStat,
  UsahaWorkspaceHero,
  UsahaWorkspaceNote,
  UsahaWorkspaceStoreSummary,
} from '../types';

export function WorkspaceHeroPanel({
  hero,
  note,
  onPrimaryTarget,
  selectedStore,
  stats,
}: {
  hero: UsahaWorkspaceHero;
  note?: UsahaWorkspaceNote | null;
  onPrimaryTarget: (target: string) => void;
  selectedStore?: UsahaWorkspaceStoreSummary | null;
  stats: UsahaFlowStat[];
}) {
  return (
    <div className="rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_18px_36px_-32px_rgba(15,23,42,0.16)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] ui-accent-text">
            {hero.eyebrow}
          </p>
          <h2 className="mt-1 text-[1.15rem] font-black leading-tight ui-text sm:text-[1.45rem]">
            {hero.title}
          </h2>
          <p className="mt-1.5 text-sm leading-6 ui-text-soft">{hero.desc}</p>
        </div>
        <HeroActions hero={hero} onPrimaryTarget={onPrimaryTarget} />
      </div>

      <SelectedStoreSummary selectedStore={selectedStore} />
      <WorkspaceStats stats={stats} />
      <WorkspaceNoteView note={note} />
    </div>
  );
}

function HeroActions({
  hero,
  onPrimaryTarget,
}: {
  hero: UsahaWorkspaceHero;
  onPrimaryTarget: (target: string) => void;
}) {
  return (
    <div className="grid w-full gap-2 sm:w-auto sm:min-w-[220px]">
      {hero.primaryTarget ? (
        <button
          type="button"
          onClick={() => onPrimaryTarget(hero.primaryTarget || '')}
          className="ui-button-primary w-full px-4 text-sm font-semibold"
        >
          {hero.primaryLabel}
        </button>
      ) : (
        <Link
          href={hero.primaryHref || hero.secondaryHref}
          className="ui-button-primary w-full px-4 text-sm font-semibold"
        >
          {hero.primaryLabel}
        </Link>
      )}
      <Link
        href={hero.secondaryHref}
        className="ui-button-secondary w-full px-4 text-sm font-semibold"
      >
        {hero.secondaryLabel}
      </Link>
    </div>
  );
}

function SelectedStoreSummary({
  selectedStore,
}: {
  selectedStore?: UsahaWorkspaceStoreSummary | null;
}) {
  if (!selectedStore) return null;

  return (
    <div className="mt-4 flex items-center gap-3 rounded-[16px] bg-[color:var(--app-surface)] px-3 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
        <Store className="h-5 w-5" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-black ui-text">
          {selectedStore.name}
        </span>
        <span className="mt-0.5 block truncate text-[11px] ui-text-soft">
          {selectedStore.summary}
        </span>
      </span>
    </div>
  );
}

function WorkspaceStats({ stats }: { stats: UsahaFlowStat[] }) {
  if (stats.length === 0) return null;

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-3">
      {stats.slice(0, 3).map(item => (
        <StatCard
          key={item.label}
          label={item.label}
          value={item.value}
          desc={item.desc}
        />
      ))}
    </div>
  );
}

function WorkspaceNoteView({ note }: { note?: UsahaWorkspaceNote | null }) {
  if (!note) return null;

  return (
    <div
      className={cn(
        'mt-4 rounded-[16px] border px-4 py-3 text-sm leading-5',
        note.tone === 'warning'
          ? 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-accent)]'
          : 'border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] text-[color:var(--app-accent)]',
      )}
    >
      {note.text}
    </div>
  );
}
