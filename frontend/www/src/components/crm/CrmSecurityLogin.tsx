'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import LajukanLogo from '@/components/logo/LajuloLogo';
import {
  AlertTriangle,
  ArrowLeftRight,
  ChevronRight,
  Clock3,
  Mail,
  ShieldCheck,
} from 'lucide-react';

type CrmSecurityLoginProps = {
  locale: string;
};

export default function CrmSecurityLogin({
  locale,
}: CrmSecurityLoginProps) {
  const isId = locale === 'id';
  const [otp, setOtp] = useState('000000');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const text = useMemo(
    () => ({
      eyebrow: isId ? 'CRM Ops' : 'CRM Ops',
      title: isId
        ? 'Lajukan CRM Security Login'
        : 'Lajukan CRM Security Login',
      description: isId
        ? 'CRM dipakai untuk approval transaksi, trust hold, support, dan review risiko. Karena itu akses agent dibuat dua langkah.'
        : 'CRM is used for transaction approvals, trust holds, support, and risk review. That is why agent access uses two steps.',
      unavailable: isId ? 'OTP service unavailable' : 'OTP service unavailable',
      step: isId ? 'Step 2 of 2' : 'Step 2 of 2',
      instruction: isId
        ? 'Masukkan OTP yang dikirim ke agent@lajukan.com.'
        : 'Enter the OTP sent to agent@lajukan.com.',
      fieldLabel: isId ? 'OTP Email' : 'Email OTP',
      submit: isId ? 'Masuk ke CRM' : 'Enter CRM',
      resend: isId ? 'Kirim ulang OTP' : 'Resend OTP',
      switchAccount: isId
        ? 'Ganti akun / ulangi login'
        : 'Switch account / restart login',
      footer: isId
        ? 'Aksi sensitif seperti approve trust profile, manual hold, dan perubahan order berisiko juga akan meminta step-up OTP ulang di dalam CRM.'
        : 'Sensitive actions such as trust-profile approval, manual holds, and risky order changes will also require step-up OTP again inside CRM.',
      unavailableHint: isId
        ? 'Layanan OTP untuk CRM sedang unavailable. Ulangi lagi setelah service pulih.'
        : 'The CRM OTP service is currently unavailable. Retry after the service recovers.',
      securityTitle: isId ? 'Kenapa dua langkah' : 'Why two steps',
      securityItems: isId
        ? [
            'Approval transaksi dan trust hold butuh agent identity yang jelas.',
            'Support CRM terhubung ke order, payout, dan review risiko.',
            'Step-up OTP dipakai lagi untuk aksi sensitif di dalam panel.',
          ]
        : [
            'Transaction approval and trust holds require clear agent identity.',
            'CRM support is tied to orders, payouts, and risk review.',
            'Step-up OTP is requested again for sensitive actions inside the panel.',
          ],
      backHome: isId ? 'Kembali ke home' : 'Back to home',
    }),
    [isId],
  );

  const handleSubmit = () => {
    if (otp.length !== 6) {
      setStatusMessage(
        isId
          ? 'Masukkan OTP 6 digit terlebih dulu.'
          : 'Enter the full 6-digit OTP first.',
      );
      return;
    }
    setStatusMessage(text.unavailableHint);
  };

  const handleResend = () => {
    setStatusMessage(text.unavailableHint);
  };

  return (
    <main className="page-shell py-4 sm:py-8">
      <div className="mx-auto grid max-w-[1080px] gap-4 lg:grid-cols-[minmax(0,1.04fr)_minmax(360px,0.96fr)]">
        <section className="ui-panel ui-hero-panel relative overflow-hidden rounded-[34px] p-5 sm:p-6 lg:p-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 top-12 h-40 w-40 rounded-full bg-emerald-200/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-14 top-0 h-44 w-44 rounded-full bg-amber-200/25 blur-3xl"
          />

          <div className="relative">
            <div className="inline-flex items-center gap-3 rounded-full border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_92%,_transparent)] px-3 py-2">
              <LajukanLogo />
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                {text.eyebrow}
              </span>
            </div>

            <h1 className="mt-5 max-w-[13ch] text-[2rem] font-[1000] leading-none tracking-tight text-[color:var(--app-text)] sm:text-[2.8rem]">
              {text.title}
            </h1>
            <p className="mt-4 max-w-[42rem] text-sm leading-6 text-[color:var(--app-text-soft)] sm:text-[15px]">
              {text.description}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {text.securityItems.map((item, index) => (
                <div
                  key={item}
                  className="ui-panel-muted rounded-[24px] border border-[color:var(--app-border)]/80 p-4"
                >
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] ui-accent-text">
                    0{index + 1}
                  </p>
                  <p className="mt-3 text-[13px] leading-6 text-[color:var(--app-text)]">
                    {item}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-[26px] border border-[color:var(--app-border)]/80 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_94%,_transparent)] p-4">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[color:var(--app-text)]">
                <ShieldCheck className="h-4 w-4 text-[color:var(--app-accent)]" />
                {text.securityTitle}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="ui-inline-meta ui-border ui-text-soft">
                  {isId ? 'Approval transaksi' : 'Transaction approval'}
                </span>
                <span className="ui-inline-meta ui-border ui-text-soft">
                  {isId ? 'Trust hold' : 'Trust hold'}
                </span>
                <span className="ui-inline-meta ui-border ui-text-soft">
                  {isId ? 'Support escalation' : 'Support escalation'}
                </span>
                <span className="ui-inline-meta ui-border ui-text-soft">
                  {isId ? 'Risk review' : 'Risk review'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="ui-panel rounded-[34px] p-5 sm:p-6 lg:p-7">
          <div className="rounded-[26px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-[color:var(--app-warning)]">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="h-4 w-4" />
              {text.unavailable}
            </p>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] ui-text-soft">
              {text.step}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
              <Clock3 className="h-3.5 w-3.5" />
              {isId ? 'Security check' : 'Security check'}
            </span>
          </div>

          <p className="mt-4 text-sm leading-6 text-[color:var(--app-text)]">
            {text.instruction}
          </p>

          <div className="mt-5">
            <label
              htmlFor="crm-email-otp"
              className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.16em] ui-text-soft"
            >
              {text.fieldLabel}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
              <input
                id="crm-email-otp"
                type="text"
                inputMode="numeric"
                value={otp}
                maxLength={6}
                onChange={event =>
                  setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="w-full rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-11 py-4 text-base font-semibold tracking-[0.35em] text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent-border)] focus:bg-[color:var(--app-surface-strong)]"
              />
            </div>
          </div>

          <div className="mt-5 grid gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              className="ui-button-primary inline-flex min-h-[52px] items-center justify-center gap-2 px-4 text-sm font-semibold"
            >
              {text.submit}
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={handleResend}
              className="ui-button-secondary inline-flex min-h-[48px] items-center justify-center px-4 text-sm font-semibold"
            >
              {text.resend}
            </button>

            <Link
              href={`/login?callbackUrl=${encodeURIComponent(`/${locale}/crm`)}`}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-sm font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)]"
            >
              <ArrowLeftRight className="h-4 w-4" />
              {text.switchAccount}
            </Link>
          </div>

          {statusMessage ? (
            <p className="mt-4 rounded-[18px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-sm text-[color:var(--app-warning)]">
              {statusMessage}
            </p>
          ) : null}

          <p className="mt-6 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {text.footer}
          </p>

          <div className="mt-6 border-t border-[color:var(--app-border)] pt-5">
            <Link
              href="/home"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] ui-accent-text"
            >
              {text.backHome}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
