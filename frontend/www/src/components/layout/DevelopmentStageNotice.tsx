'use client';

type DevelopmentStageNoticeProps = {
  locale: string;
};

export function DevelopmentStageNotice({ locale }: DevelopmentStageNoticeProps) {
  const isId = locale === 'id';

  return (
    <div
      className="ui-layer-header pointer-events-none fixed right-2 select-none opacity-40 sm:right-3"
      role="status"
      aria-label={
        isId
          ? 'Tahap development, belum aplikasi final'
          : 'Development preview, not final'
      }
      style={{ top: 'max(0.45rem, env(safe-area-inset-top))' }}
    >
      <div className="rounded-full border border-slate-950/10 bg-white/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-950 shadow-sm backdrop-blur-md dark:border-white/15 dark:bg-slate-950/55 dark:text-white sm:px-3 sm:text-[10px]">
        <span className="sm:hidden">DEV</span>
        <span className="hidden sm:inline">DEV PREVIEW</span>
      </div>
    </div>
  );
}
