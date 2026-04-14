'use client';

import { Link } from '@/i18n/navigation';
import { Clock3, ShieldCheck, Sparkles, Wallet } from 'lucide-react';

type SuperAppLoginGateProps = {
  isId: boolean;
  serviceLabel: string;
  fareLabel?: string;
  etaLabel?: string;
  pickupLabel?: string;
  dropoffLabel?: string;
  vehicleLabel?: string;
  paymentLabel?: string;
  promoLabel?: string | null;
};

export function SuperAppLoginGate({
  isId,
  serviceLabel,
  fareLabel,
  etaLabel,
  pickupLabel,
  dropoffLabel,
  vehicleLabel,
  paymentLabel,
  promoLabel,
}: SuperAppLoginGateProps) {
  const highlights = isId
    ? [
        'Simpan Rumah, Kerja, dan perjalanan terakhir',
        'Tracking driver real-time setelah order dibuat',
        'Pembayaran lebih cepat dengan saldo dan voucher',
      ]
    : [
        'Save Home, Work, and recent destinations',
        'Unlock real-time driver tracking after booking',
        'Move faster with wallet and promo checkout',
      ];

  return (
    <section className="ui-panel ui-hero-panel rounded-[32px] p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
            <Sparkles className="h-3.5 w-3.5" />
            {isId ? 'Lanjutkan booking' : 'Continue booking'}
          </p>
          <h3 className="mt-3 text-xl font-[1000] leading-tight tracking-tight text-[color:var(--app-text)]">
            {isId
              ? 'Masuk dulu untuk konfirmasi order tanpa kehilangan detail perjalanan'
              : 'Sign in to confirm the order without losing trip details'}
          </h3>
          <p className="mt-2 max-w-[38rem] text-sm text-[color:var(--app-text-soft)]">
            {isId
              ? 'Pickup, tujuan, estimasi harga, dan opsi kendaraan sudah siap. Tinggal login untuk kirim order ke sistem dispatch.'
              : 'Pickup, destination, estimated fare, and vehicle choice are ready. Sign in to send the order into dispatch.'}
          </p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-success)]">
          <ShieldCheck className="h-3.5 w-3.5" />
          {isId ? 'Aman, cepat, dan tersimpan' : 'Secure, fast, and saved'}
        </span>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map((item, index) => (
            <div
              key={item}
              className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[var(--app-shadow-soft)]"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-sm font-bold text-[color:var(--app-accent)]">
                0{index + 1}
              </span>
              <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)]">
                {item}
              </p>
            </div>
          ))}
        </div>

        <aside className="rounded-[28px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)] p-4 shadow-[var(--app-shadow)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Ringkasan booking' : 'Booking summary'}
              </p>
              <p className="mt-1 text-base font-semibold text-[color:var(--app-text)]">
                {serviceLabel}
              </p>
            </div>
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
              <Wallet className="h-4.5 w-4.5" />
            </span>
          </div>

          <div className="mt-4 grid gap-2">
            {pickupLabel ? (
              <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Pickup' : 'Pickup'}
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                  {pickupLabel}
                </p>
              </div>
            ) : null}
            {dropoffLabel ? (
              <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Tujuan' : 'Destination'}
                </p>
                <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                  {dropoffLabel}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Estimasi' : 'Estimate'}
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                {fareLabel || '--'}
              </p>
            </div>
            <div className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                ETA
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                {etaLabel || '--'}
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
            <p className="inline-flex items-center gap-2 font-semibold text-[color:var(--app-text)]">
              <Clock3 className="h-4 w-4 text-[color:var(--app-accent)]" />
              {isId ? 'Yang akan dibawa ke checkout' : 'What carries into checkout'}
            </p>
            <div className="mt-2 grid gap-1">
              {vehicleLabel ? <p>{vehicleLabel}</p> : null}
              {paymentLabel ? <p>{paymentLabel}</p> : null}
              {promoLabel ? <p>{promoLabel}</p> : null}
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Link
              href="/login"
              className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
            >
              {isId ? 'Masuk untuk pesan' : 'Sign in to book'}
            </Link>
            <Link
              href="/register"
              className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
            >
              {isId ? 'Buat akun baru' : 'Create account'}
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
