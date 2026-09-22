export default function LocaleLoading() {
  return (
    <main
      className="relative grid min-h-[100svh] place-items-center overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#f1fbf4_0%,#ffffff_42%,#f8fafc_100%)] px-6 text-slate-950 dark:bg-[radial-gradient(circle_at_50%_42%,#123323_0%,#07130d_42%,#020617_100%)] dark:text-white"
      role="status"
      aria-live="polite"
      aria-label="Memuat Lajukan"
    >
      <style>{`
        @keyframes lajukan-logo-breathe {
          0%, 100% {
            transform: translateZ(0) scale(1);
            opacity: 0.96;
          }
          50% {
            transform: translateZ(0) scale(1.045);
            opacity: 1;
          }
        }

        @keyframes lajukan-logo-orbit {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes lajukan-logo-glow {
          0%, 100% {
            opacity: 0.28;
            transform: scale(0.92);
          }
          50% {
            opacity: 0.5;
            transform: scale(1.08);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lajukan-loading-motion,
          .lajukan-loading-orbit,
          .lajukan-loading-glow {
            animation: none !important;
          }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        <div className="lajukan-loading-glow absolute h-32 w-32 rounded-full bg-emerald-400/30 blur-3xl dark:bg-emerald-400/20" />

        <div className="relative grid h-24 w-24 place-items-center">
          <div className="absolute inset-0 rounded-[30px] border border-emerald-200/80 bg-white/75 shadow-[0_20px_70px_-28px_rgba(16,185,129,0.48)] backdrop-blur-sm dark:border-emerald-500/20 dark:bg-slate-900/80" />

          <div className="lajukan-loading-orbit absolute inset-[-7px] rounded-[35px] border border-transparent border-t-emerald-500 border-r-emerald-300/80">
            <span className="absolute left-1/2 top-[-3px] h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500 shadow-[0_0_14px_rgba(16,185,129,0.95)]" />
          </div>

          <div className="lajukan-loading-motion relative grid h-16 w-16 place-items-center rounded-[21px] bg-emerald-700 text-white shadow-[0_16px_38px_-18px_rgba(5,150,105,0.85)]">
            <span className="text-[34px] font-black leading-none tracking-[-0.08em]">L</span>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[11px] font-black uppercase tracking-[0.32em] text-emerald-700 dark:text-emerald-400">
            Lajukan
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-500 dark:text-slate-400">
            Memuat…
          </p>
        </div>

        <div className="mt-5 h-1.5 w-24 overflow-hidden rounded-full bg-emerald-100/90 dark:bg-emerald-950/70">
          <div className="h-full w-2/5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)] animate-[lajukan-loading-bar_1.4s_ease-in-out_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes lajukan-loading-bar {
          0% {
            transform: translateX(-140%);
          }
          50% {
            transform: translateX(90%);
          }
          100% {
            transform: translateX(260%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-\[lajukan-loading-bar_1\.4s_ease-in-out_infinite\] {
            animation: none !important;
            transform: translateX(0);
          }
        }
      `}</style>
    </main>
  );
}
