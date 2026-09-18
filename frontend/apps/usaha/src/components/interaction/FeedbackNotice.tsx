export type FeedbackTone = 'success' | 'error' | 'info' | 'warning';

type Props = {
  message: string;
  tone?: FeedbackTone;
  className?: string;
};

const toneClass: Record<FeedbackTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-red-200 bg-red-50 text-red-700',
  info: 'border-portal-line bg-white text-portal-soft',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
};

export function FeedbackNotice({ message, tone = 'info', className = '' }: Props) {
  if (!message) return null;
  const isError = tone === 'error';

  return (
    <p
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      className={`rounded-xl border px-4 py-3 text-xs font-semibold ${toneClass[tone]} ${className}`.trim()}
    >
      {message}
    </p>
  );
}
