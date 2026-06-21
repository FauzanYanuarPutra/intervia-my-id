'use client';

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastVariant = 'success' | 'info' | 'error';

type ToastPayload = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  durationMs?: number;
};

type ToastItem = ToastPayload & {
  id: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  notify: (payload: ToastPayload) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function variantClasses(variant: ToastVariant): string {
  if (variant === 'success') {
    return 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_50%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_40%,_transparent)] dark:text-[color:var(--app-accent)]';
  }
  if (variant === 'error') {
    return 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_50%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_40%,_transparent)] dark:text-[color:var(--app-danger)]';
  }
  return 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]';
}

function VariantIcon({ variant }: { variant: ToastVariant }) {
  if (variant === 'success') return <CheckCircle2 className="h-4 w-4" />;
  if (variant === 'error') return <TriangleAlert className="h-4 w-4" />;
  return <Info className="h-4 w-4" />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (payload: ToastPayload) => {
      const item: ToastItem = {
        ...payload,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        variant: payload.variant || 'info',
      };
      setToasts((prev) => [...prev, item]);

      const ttl = Math.max(1500, payload.durationMs || 3200);
      window.setTimeout(() => dismiss(item.id), ttl);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="ui-layer-local-topbar pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] mx-auto flex w-[min(420px,calc(100vw-1.5rem))] flex-col gap-2 px-3 pb-3 sm:inset-x-auto sm:right-3 sm:mx-0 sm:px-0 sm:pb-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            className={cn(
              'pointer-events-auto rounded-2xl border p-3 shadow-lg backdrop-blur',
              variantClasses(toast.variant),
            )}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5">
                <VariantIcon variant={toast.variant} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? <p className="mt-0.5 text-sm opacity-80">{toast.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                className="inline-flex h-9 w-9 touch-manipulation items-center justify-center rounded-xl hover:bg-[color:color-mix(in_srgb,_var(--app-overlay)_5%,_transparent)] dark:hover:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_10%,_transparent)]"
                aria-label="Close notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside ToastProvider');
  }
  return ctx;
}
