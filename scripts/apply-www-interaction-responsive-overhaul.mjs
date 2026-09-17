import fs from 'node:fs';

function replaceExact(path, before, after, label) {
  const source = fs.readFileSync(path, 'utf8');
  if (!source.includes(before)) {
    throw new Error(`Missing expected source for ${label} in ${path}`);
  }
  fs.writeFileSync(path, source.replace(before, after));
  console.log(`patched: ${label}`);
}

const reels = 'frontend/apps/www/src/app/[locale]/(shared)/reels/ReelsClient.tsx';
const community = 'frontend/apps/www/src/components/community/CommunityFeedClient.tsx';
const explore = 'frontend/apps/www/src/components/explore/ExploreVisualSystem.tsx';
const umkm = 'frontend/apps/www/src/components/super-app/UmkmDiscoveryClient.tsx';
const contract = 'frontend/apps/www/src/lib/ux/wwwInteractionResponsiveContract.test.ts';

replaceExact(
  reels,
  'sm:max-w-[560px] sm:justify-center xl:max-w-[1040px] xl:grid-cols-[220px_minmax(0,600px)] 2xl:max-w-[1380px] 2xl:grid-cols-[240px_minmax(0,620px)_360px]',
  'sm:max-w-[560px] sm:justify-center md:max-w-[720px] xl:max-w-[1160px] xl:grid-cols-[220px_minmax(0,720px)] 2xl:max-w-[1480px] 2xl:grid-cols-[230px_minmax(0,760px)_minmax(320px,450px)]',
  'Reels responsive grid',
);
replaceExact(
  reels,
  'sm:right-[calc(env(safe-area-inset-right)+10px)] max-[370px]:scale-[0.9]',
  'sm:right-[calc(env(safe-area-inset-right)+10px)] max-[380px]:scale-[0.88]',
  'Reels small-phone action rail',
);
replaceExact(
  reels,
  "          disabled={actionState.loading === 'follow'}\n          aria-label={",
  "          disabled={actionState.loading === 'follow'}\n          aria-pressed={actionState.followed}\n          aria-busy={actionState.loading === 'follow'}\n          aria-label={",
  'Reels follow semantics',
);
replaceExact(
  reels,
  '            disabled={action.loading || action.disabled}\n            aria-label={action.ariaLabel}',
  '            disabled={action.loading || action.disabled}\n            aria-pressed={action.active}\n            aria-busy={action.loading}\n            aria-label={action.ariaLabel}',
  'Reels action semantics',
);

replaceExact(
  community,
  "const COMMUNITY_MODAL_SHELL_CLASS =\n  'ui-layer-modal fixed inset-0 z-[10000] flex items-end justify-center bg-slate-950/45 p-0  sm:items-center sm:p-4';",
  "const COMMUNITY_MODAL_SHELL_CLASS =\n  'ui-layer-modal fixed inset-0 z-[10000] flex min-h-[var(--app-visual-viewport-height)] items-end justify-center overflow-hidden overscroll-contain bg-slate-950/45 p-0 pb-[env(safe-area-inset-bottom)] dark:bg-slate-950/70 sm:items-center sm:p-4 sm:pb-4';",
  'Community modal viewport shell',
);
replaceExact(
  community,
  "const COMMUNITY_MODAL_SURFACE_CLASS =\n  'flex h-full w-full flex-col overflow-hidden shadow-[0_30px_80px_-40px_rgba(15,23,42,0.42)] sm:h-auto sm:max-h-[calc(var(--app-viewport-height)-2rem)] sm:rounded-[24px]';",
  "const COMMUNITY_MODAL_SURFACE_CLASS =\n  'flex h-[var(--app-visual-viewport-height)] w-full flex-col overflow-hidden overscroll-contain bg-white text-slate-950 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.42)] dark:bg-slate-950 dark:text-slate-50 sm:h-auto sm:max-h-[calc(var(--app-visual-viewport-height)-2rem)] sm:rounded-[24px]';",
  'Community modal responsive surface',
);
replaceExact(
  community,
  '              disabled={votingIndex !== null}\n              className={cn(',
  '              disabled={votingIndex !== null}\n              aria-pressed={selected}\n              aria-busy={voting}\n              className={cn(',
  'Community poll selected and busy semantics',
);
replaceExact(
  community,
  "                'group relative w-full overflow-hidden rounded-[16px] border bg-white p-3 text-left transition hover:border-[color:var(--app-accent-border)] disabled:cursor-wait',",
  "                'group relative min-h-11 w-full overflow-hidden rounded-[16px] border bg-white p-3 text-left transition hover:border-[color:var(--app-accent-border)] disabled:cursor-wait dark:bg-slate-900',",
  'Community poll touch target and dark surface',
);

replaceExact(
  explore,
  '            aria-selected={active ? true : undefined}\n            onClick={() => onChange(option.value)}',
  "            aria-selected={active}\n            tabIndex={active ? 0 : -1}\n            data-state={active ? 'active' : 'inactive'}\n            onClick={() => onChange(option.value)}",
  'Explore tab semantics',
);

replaceExact(
  umkm,
  'className="relative w-full bg-slate-100 text-[color:var(--app-text)] dark:bg-slate-950"',
  'className="relative w-full bg-slate-100 pb-[env(safe-area-inset-bottom)] text-[color:var(--app-text)] dark:bg-slate-950"',
  'UMKM safe-area shell',
);
replaceExact(
  umkm,
  'className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 lg:hidden"',
  'className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 lg:hidden"',
  'UMKM back touch target',
);
replaceExact(
  umkm,
  'className="inline-flex min-h-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 sm:min-h-[36px] sm:px-3.5"',
  'className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3.5 text-[11px] font-bold text-white shadow-[0_14px_28px_-22px_color-mix(in_srgb,var(--app-accent)_46%,transparent)] transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 sm:min-h-11 sm:px-4"',
  'UMKM search touch target',
);
for (const [before, after, label] of [
  ["'inline-flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:min-h-[34px]'", "'inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]'", 'UMKM all-location touch target'],
  ['className="inline-flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] px-2.5 text-[11px] font-bold text-white shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:min-h-[34px]"', 'className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-white shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"', 'UMKM city-clear touch target'],
  ["'inline-flex min-h-[32px] shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] sm:min-h-[34px] sm:px-3'", "'inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[11px] font-bold shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]'", 'UMKM lane touch targets'],
  ['className="inline-flex min-h-[32px] shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/80 bg-white/92 px-2.5 text-[11px] font-bold text-slate-700 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/86 dark:text-slate-100 sm:min-h-[34px] sm:px-3"', 'className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-white/80 bg-white/92 px-3 text-[11px] font-bold text-slate-700 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.28)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] dark:border-white/10 dark:bg-slate-950/86 dark:text-slate-100"', 'UMKM more-filter touch target'],
]) {
  replaceExact(umkm, before, after, label);
}

replaceExact(
  contract,
  '    expect(reels).toContain("aria-pressed={actionState.liked}");\n    expect(reels).toContain("aria-pressed={actionState.saved}");\n    expect(reels).toContain("aria-pressed={actionState.followed}");\n    expect(reels).toContain("aria-busy={action.loading}");',
  '    expect(reels).toContain("active: actionState.liked");\n    expect(reels).toContain("active: actionState.saved");\n    expect(reels).toContain("aria-pressed={action.active}");\n    expect(reels).toContain("aria-busy={action.loading}");\n    expect(reels).toContain("aria-pressed={actionState.followed}");\n    expect(reels).toContain("aria-busy={actionState.loading === \'follow\'}");',
  'Reels behavior contract aligned to action renderer',
);

console.log('WWW interaction/responsive overhaul applied successfully.');
