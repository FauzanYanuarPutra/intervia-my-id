'use client';

import { useRouter, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguageModal } from './LanguageModalContext';
import { Z_INDEX } from '@/components/constants/z-index';
import { X, Check, Globe } from 'lucide-react';

const localeDetails: Record<string, { name: string; code: string }> = {
  en: { name: 'English', code: 'us' },
  id: { name: 'Indonesia', code: 'id' },
};

export function LanguageModal() {
  const { isOpen, close, isMandatory, currentLocale, confirmLocale } =
    useLanguageModal();
  const router = useRouter();
  const pathname = usePathname();

  const switchLocale = (target: string) => {
    confirmLocale(target);
    if (target !== currentLocale) {
      router.replace(pathname, { locale: target });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-[color:color-mix(in_srgb,_var(--app-overlay)_40%,_transparent)] backdrop-blur-sm"
            style={{ zIndex: Z_INDEX.bgBlur + Z_INDEX.modal - 1 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={isMandatory ? undefined : close}
          />

          <div
            className="fixed inset-0 flex items-center justify-center pointer-events-none px-4"
            style={{ zIndex: Z_INDEX.modal + Z_INDEX.modal }}
          >
            <motion.div
              className="pointer-events-auto max-h-[80svh] w-full max-w-[320px] overflow-y-auto rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)]"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
            >
              <div className="mb-4 flex items-center justify-between pl-2">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-[color:var(--app-accent)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                    {isMandatory ? 'Choose Language' : 'Language'}
                  </span>
                </div>
                {!isMandatory ? (
                  <button
                    type="button"
                    onClick={close}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] transition-colors hover:text-[color:var(--app-danger)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)]"
                    aria-label="Close language selector"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                ) : null}
              </div>

              <p className="mb-3 rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-2 text-[11px] font-semibold text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]">
                {isMandatory
                  ? 'Pilih bahasa dulu untuk lanjut. Pilihan ini aktif 30 hari.'
                  : 'Ubah bahasa kapan saja.'}
              </p>

              <div className="flex flex-col gap-1.5">
                {routing.locales.map(loc => {
                  const active = loc === currentLocale;
                  const details = localeDetails[loc];

                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => switchLocale(loc)}
                      className={`flex items-center justify-between w-full p-2 rounded-2xl border transition-all ${
                        active
                          ? 'bg-[color:var(--app-accent)] border-[color:var(--app-accent-border)] text-[color:var(--app-text-inverse)] shadow-lg shadow-[var(--app-shadow)]'
                          : 'bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] border-transparent text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] dark:hover:bg-[color:var(--app-surface-strong)]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-7 w-9 rounded-md overflow-hidden border border-[color:color-mix(in_srgb,_var(--app-border-strong)_5%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] shrink-0">
                          <img
                            src={`https://flagcdn.com/w80/${details.code}.png`}
                            alt={details.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <span className="text-xs font-[1000] uppercase tracking-tighter">
                          {details?.name}
                        </span>
                      </div>

                      {active && (
                        <div className="mr-2 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)] p-1 rounded-full">
                          <Check size={10} strokeWidth={4} />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-center text-[7px] font-black uppercase tracking-[0.4em] text-[color:var(--app-text)] opacity-30">
                Laju Global
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
