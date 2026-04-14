'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { useAuth } from '@/context/AuthContext';
import { createIdempotencyKey } from '@/lib/clientIdempotency';

export default function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const locale = useLocale() || 'id';
  const { authFetch } = useAuth();
  const { notify } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [formMessage, setFormMessage] = useState<{
    variant: 'error' | 'success';
    text: string;
  } | null>(null);

  useEffect(() => {
    params.then(p => setTransactionId(p.id));
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormMessage(null);

    if (rating === 0) {
      setFormMessage({
        variant: 'error',
        text:
          locale === 'id'
            ? 'Pilih nilai dulu.'
            : 'Please select a rating.',
      });
      return;
    }

    if (!transactionId) return;

    setLoading(true);
    try {
      const res = await authFetch(`/api/transactions/${transactionId}/review`, {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': createIdempotencyKey('review'),
        },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (res.ok) {
        notify({
          title: locale === 'id' ? 'Ulasan terkirim' : 'Review submitted',
          description:
            locale === 'id'
              ? 'Terima kasih, ulasan kamu sudah masuk.'
              : 'Thank you for sharing your feedback.',
          variant: 'success',
        });
        router.push('/transactions');
      } else {
        const errorData = await res.json().catch(() => ({}));
        setFormMessage({
          variant: 'error',
          text:
            errorData.error ||
            (locale === 'id'
              ? 'Gagal mengirim ulasan.'
              : 'Failed to submit review.'),
        });
      }
    } catch (error) {
      console.error(error);
      setFormMessage({
        variant: 'error',
        text:
          locale === 'id'
            ? 'Terjadi kendala saat mengirim ulasan.'
            : 'Error submitting review.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="mx-auto w-full max-w-2xl px-0 py-8 sm:px-6 lg:px-8">
        <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:var(--app-surface-strong)] p-6 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-3xl sm:border-x sm:p-8">
          <h1 className="text-xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-2xl">
            {locale === 'id' ? 'Beri ulasan' : 'Leave a review'}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--app-text)]">
            {locale === 'id'
              ? 'Tulis singkat saja. Detail lain tidak perlu.'
              : 'Keep it short. Extra detail is not necessary.'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            {formMessage ? (
              <div
                className={`rounded-2xl border px-4 py-3 text-sm ${
                  formMessage.variant === 'error'
                    ? 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]'
                    : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                }`}
              >
                {formMessage.text}
              </div>
            ) : null}

            <div>
              <label className="mb-3 block text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Nilai transaksi' : 'Rating'} *
              </label>
              <div className="flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => {
                  const starValue = i + 1;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setRating(starValue)}
                      onMouseEnter={() => setHoverRating(starValue)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="text-4xl transition-colors focus:outline-none"
                    >
                      <span
                        className={
                          starValue <= (hoverRating || rating)
                            ? 'text-[color:var(--app-warning)]'
                            : 'text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)]'
                        }
                      >
                        {'\u2605'}
                      </span>
                    </button>
                  );
                })}
              </div>
              {rating > 0 ? (
                <p className="mt-2 text-sm text-[color:var(--app-text)]">
                  {locale === 'id'
                    ? rating === 5
                      ? 'Sangat puas'
                      : rating === 4
                        ? 'Puas'
                        : rating === 3
                          ? 'Biasa'
                          : rating === 2
                            ? 'Kurang'
                            : 'Buruk'
                    : rating === 5
                      ? 'Excellent'
                      : rating === 4
                        ? 'Good'
                        : rating === 3
                          ? 'Average'
                          : rating === 2
                            ? 'Below average'
                            : 'Poor'}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Catatan singkat' : 'Comment'} (
                {locale === 'id' ? 'opsional' : 'optional'})
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={
                  locale === 'id'
                    ? 'Tulis poin penting saja...'
                    : 'Share the important point only...'
                }
                rows={4}
                className="w-full rounded-xl border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] px-4 py-3 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.back()}
                className="h-12 rounded-xl border border-[color:var(--app-border)] px-6 text-sm font-semibold dark:border-[color:var(--app-border-strong)]"
              >
                {locale === 'id' ? 'Nanti' : 'Cancel'}
              </button>
              <button
                type="submit"
                disabled={loading || rating === 0}
                className="flex-1 h-12 rounded-xl bg-[color:var(--app-accent)] font-semibold text-[color:var(--app-text-inverse)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? locale === 'id'
                    ? 'Mengirim...'
                    : 'Submitting...'
                  : locale === 'id'
                    ? 'Kirim ulasan'
                    : 'Submit review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
