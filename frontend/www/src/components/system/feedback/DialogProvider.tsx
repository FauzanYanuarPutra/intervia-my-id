'use client';

import { Modal } from '@/components/common/Modal';
import { TriangleAlert } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

type DialogTone = 'default' | 'danger';

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type PromptOptions = ConfirmOptions & {
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  multiline?: boolean;
};

type ConfirmRequest = ConfirmOptions & {
  type: 'confirm';
  resolve: (value: boolean) => void;
};

type PromptRequest = PromptOptions & {
  type: 'prompt';
  resolve: (value: string | null) => void;
};

type DialogRequest = ConfirmRequest | PromptRequest;

type DialogContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

function resolveConfirmLabels(request: DialogRequest) {
  return {
    confirmLabel:
      request.confirmLabel || (request.tone === 'danger' ? 'Lanjutkan' : 'OK'),
    cancelLabel: request.cancelLabel || 'Batal',
  };
}

function confirmButtonClasses(tone: DialogTone) {
  if (tone === 'danger') {
    return 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger)] text-[color:var(--app-text-inverse)] hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_86%,_black)]';
  }
  return 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]';
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [inputValue, setInputValue] = useState('');

  const closeDialog = useCallback(() => {
    if (!request) return;
    if (request.type === 'confirm') {
      request.resolve(false);
    } else {
      request.resolve(null);
    }
    setRequest(null);
    setInputValue('');
  }, [request]);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        setInputValue('');
        setRequest({
          type: 'confirm',
          ...options,
          resolve,
        });
      }),
    [],
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>(resolve => {
        setInputValue(options.defaultValue || '');
        setRequest({
          type: 'prompt',
          ...options,
          resolve,
        });
      }),
    [],
  );

  const submitDialog = useCallback(() => {
    if (!request) return;

    if (request.type === 'confirm') {
      request.resolve(true);
      setRequest(null);
      return;
    }

    const trimmedValue = inputValue.trim();
    if (request.required && !trimmedValue) return;

    request.resolve(trimmedValue);
    setRequest(null);
    setInputValue('');
  }, [inputValue, request]);

  const value = useMemo<DialogContextValue>(
    () => ({
      confirm,
      prompt,
    }),
    [confirm, prompt],
  );

  const labels = request ? resolveConfirmLabels(request) : null;

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal
        open={Boolean(request)}
        title={request?.title || 'Dialog'}
        onClose={closeDialog}
        footer={
          request && labels ? (
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeDialog}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface)]"
              >
                {labels.cancelLabel}
              </button>
              <button
                type="button"
                onClick={submitDialog}
                className={`inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition ${confirmButtonClasses(request.tone || 'default')}`}
              >
                {labels.confirmLabel}
              </button>
            </div>
          ) : null
        }
      >
        {request ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
              <span
                className={`mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl ${
                  request.tone === 'danger'
                    ? 'bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]'
                    : 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                }`}
              >
                <TriangleAlert className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                {request.description ? (
                  <p className="text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {request.description}
                  </p>
                ) : null}
              </div>
            </div>

            {request.type === 'prompt' ? (
              request.multiline ? (
                <textarea
                  value={inputValue}
                  onChange={event => setInputValue(event.target.value)}
                  placeholder={request.placeholder}
                  rows={4}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]"
                />
              ) : (
                <input
                  value={inputValue}
                  onChange={event => setInputValue(event.target.value)}
                  placeholder={request.placeholder}
                  className="w-full rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)] dark:text-[color:var(--app-text-soft)]"
                />
              )
            ) : null}
          </div>
        ) : null}
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialog must be used inside DialogProvider');
  }
  return ctx;
}
