// app/[locale]/contact/page.tsx
import { Metadata } from 'next';
import { LocalizedLink } from '@/components/ui-kit';
import { ArrowUpRight, Mail, MessageCircle, Phone } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Hubungi Kami | Lajukan',
  description:
    'Hubungi tim Lajukan untuk pertanyaan tentang supplier, sourcing, storefront usaha, jasa operasional, dan transaksi.',
  keywords: [
    'hubungi laju',
    'kontak',
    'customer service',
    'support umkm',
    'support supplier',
    'laju contact',
  ],
};

export default function ContactPage() {
  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-0 py-10 sm:px-4 sm:py-14">
      <div className="rounded-none border border-x-0 border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-gradient-to-br from-[color:var(--app-surface-strong)] via-[color:color-mix(in_srgb,_var(--app-accent-soft)_20%,_transparent)] to-[color:color-mix(in_srgb,_var(--app-info-soft)_30%,_transparent)] p-6 dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] dark:from-[color:var(--app-surface-strong)] dark:via-[color:var(--app-surface-strong)] dark:to-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] sm:rounded-3xl sm:border-x sm:p-8 lg:p-10">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
          Contact Center
        </p>
        <h1 className="mt-2 text-3xl sm:text-4xl font-[1000] tracking-tight dark:text-[color:var(--app-text-inverse)]">
          Tim kami siap bantu jalur operasional usaha Anda
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          Pilih kanal yang paling cepat untuk kebutuhan Anda, dari supplier, transaksi, storefront usaha, sampai masalah trust yang perlu eskalasi.
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="mailto:support@lajukan.com?subject=Support%20Lajukan"
            className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:var(--app-surface-strong)] p-4 hover:border-[color:var(--app-accent-border)] transition"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]">
              <Mail className="h-4 w-4" />
            </span>
            <h2 className="mt-3 text-sm font-black dark:text-[color:var(--app-text-inverse)]">Email Support</h2>
            <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              Untuk ticket supplier, transaksi, dan operasional usaha.
            </p>
            <p className="mt-3 text-xs font-bold text-[color:var(--app-accent)]">
              support@lajukan.com
            </p>
          </a>

          <a
            href="tel:+622112345678"
            className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:var(--app-surface-strong)] p-4 hover:border-[color:var(--app-accent-border)] transition"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]">
              <Phone className="h-4 w-4" />
            </span>
            <h2 className="mt-3 text-sm font-black dark:text-[color:var(--app-text-inverse)]">Hotline</h2>
            <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              Untuk kebutuhan mendesak, verifikasi cepat, dan kasus transaksi sensitif.
            </p>
            <p className="mt-3 text-xs font-bold text-[color:var(--app-accent)]">
              +62 21 1234 5678
            </p>
          </a>

          <LocalizedLink
            href="/chat"
            className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:var(--app-surface-strong)] p-4 hover:border-[color:var(--app-accent-border)] transition"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]">
              <MessageCircle className="h-4 w-4" />
            </span>
            <h2 className="mt-3 text-sm font-black dark:text-[color:var(--app-text-inverse)]">Live Chat</h2>
            <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              Diskusi langsung dengan tim operasional Lajukan.
            </p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[color:var(--app-accent)]">
              Buka chat
              <ArrowUpRight className="h-3.5 w-3.5" />
            </p>
          </LocalizedLink>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <LocalizedLink
            href="/support"
            className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--app-accent)] px-4 py-2 text-xs font-black text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent)] transition"
          >
            Buka Help Center
            <ArrowUpRight className="h-4 w-4" />
          </LocalizedLink>
          <LocalizedLink
            href="/super-app"
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] dark:border-[color:var(--app-border-strong)] px-4 py-2 text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] transition"
          >
            Buka Super App usaha
          </LocalizedLink>
        </div>
      </div>
    </section>
  );
}
