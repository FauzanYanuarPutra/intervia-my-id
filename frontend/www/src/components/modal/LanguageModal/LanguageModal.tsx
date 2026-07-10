'use client';

import { useRouter, usePathname } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguageModal } from './LanguageModalContext';
import { Z_INDEX } from '@/components/constants/z-index';
import { X, Check, Globe } from 'lucide-react';

const localeOrder = ['id', 'en'] as const;
type LocaleChoice = (typeof localeOrder)[number];

const localeDetails: Record<
  LocaleChoice,
  { name: string; code: string; hint: string }
> = {
  id: {
    name: 'Bahasa Indonesia',
    code: 'id',
    hint: 'Cocok kalau kamu pakai Lajukan buat pasar lokal.',
  },
  en: {
    name: 'English',
    code: 'us',
    hint: 'Pakai kalau kamu nyaman dengan navigasi bahasa Inggris.',
  },
};

export function LanguageModal() {
  const { isOpen, close, isMandatory, currentLocale, confirmLocale } =
    useLanguageModal();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isId = currentLocale === 'id';

  const switchLocale = (target: LocaleChoice) => {
    confirmLocale(target);
    if (target !== currentLocale) {
      const query = searchParams?.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.replace(href, { locale: target });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-[color:color-mix(in_srgb,_var(--app-overlay)_40%,_transparent)] "
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
              className="pointer-events-auto max-h-[80svh] w-full max-w-[420px] overflow-y-auto rounded-[2rem] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:p-5"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
            >
              <div className="mb-4 flex items-center justify-between pl-2">
                <div className="flex items-center gap-2">
                  <Globe size={14} className="text-[color:var(--app-accent)]" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-text-soft)]">
                    {isId ? 'Bahasa' : 'Language'}
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

              <p className="mb-4 rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-2.5 text-[11px] font-semibold leading-relaxed text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]">
                {isMandatory
                  ? isId
                    ? 'Pilih bahasa yang paling nyaman. Halaman /id otomatis memakai Bahasa Indonesia.'
                    : 'Choose your preferred language. /en pages use English automatically.'
                  : isId
                    ? 'Ubah bahasa kapan saja dari sini.'
                    : 'Change language anytime from here.'}
              </p>

              <div className="flex flex-col gap-2">
                {localeOrder.map(loc => {
                  const active = loc === currentLocale;
                  const details = localeDetails[loc];

                  return (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => switchLocale(loc)}
                      className={`flex w-full items-center justify-between rounded-2xl border p-3 text-left transition-all ${active
                          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-lg shadow-[var(--app-shadow)]'
                          : 'border-transparent bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]'
                        }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="h-8 w-10 shrink-0 overflow-hidden rounded-lg border border-[color:color-mix(in_srgb,_var(--app-border-strong)_5%,_transparent)] bg-white/60 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)]">
                          <img
                            src={`https://flagcdn.com/w80/${details.code}.png`}
                            alt={details.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold tracking-tight">
                            {details.name}
                          </div>
                          <div
                            className={`mt-0.5 truncate text-[11px] font-medium ${active
                                ? 'text-white/82'
                                : 'text-[color:var(--app-text-soft)]'
                              }`}
                          >
                            {details.hint}
                          </div>
                        </div>
                      </div>

                      {active ? (
                        <div className="ml-3 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)]">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-center text-[9px] font-bold uppercase tracking-[0.35em] text-[color:var(--app-text)] opacity-30">
                Lajukan
              </p>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
