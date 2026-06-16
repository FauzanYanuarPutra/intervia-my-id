'use client';

import { WorkspaceHeroPanel } from './components/WorkspaceHeroPanel';
import { WorkspaceNavGrid } from './components/WorkspaceNavGrid';
import type {
  UsahaFlowNavItem,
  UsahaFlowStat,
  UsahaWorkspaceHero,
  UsahaWorkspaceNote,
  UsahaWorkspaceStoreSummary,
} from './types';

export function UsahaWorkspaceShell({
  hero,
  isId,
  navItems,
  note,
  onPrimaryTarget,
  selectedStore,
  stats,
}: {
  hero: UsahaWorkspaceHero;
  isId: boolean;
  navItems: UsahaFlowNavItem[];
  note?: UsahaWorkspaceNote | null;
  onPrimaryTarget: (target: string) => void;
  selectedStore?: UsahaWorkspaceStoreSummary | null;
  stats: UsahaFlowStat[];
}) {
  return (
    <div className="space-y-4">
      <WorkspaceHeroPanel
        hero={hero}
        note={note}
        onPrimaryTarget={onPrimaryTarget}
        selectedStore={selectedStore}
        stats={stats}
      />
      <WorkspaceNavGrid items={navItems} />
      <p className="sr-only">
        {isId ? 'Alur usaha dibuat ringkas.' : 'Business flow is simplified.'}
      </p>
    </div>
  );
}
