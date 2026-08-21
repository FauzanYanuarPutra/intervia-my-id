// app/[locale]/contact/page.tsx
import { Metadata } from 'next';
import { LocalizedLink } from '@/components/ui-kit';
import {
  ArrowUpRight,
  Mail,
  MessageCircle,
  Phone,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Hubungi Kami | Lajukan',
  description:
    'Kontak resmi Lajukan untuk bantuan akun, posting, pencarian supplier, dan verifikasi usaha.',
  keywords: [
    'hubungi laju',
    'kontak',
    'customer service',
    'support umkm',
    'support supplier',
    'laju contact',
  ],
};

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function ContactPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const businessPhone = '0821 1714 8623';
  const businessPhoneHref = 'tel:+6282117148623';
  const businessWhatsappHref = 'https://wa.me/6282117148623';

  const channels = [
    {
      href: 'mailto:support@lajukan.com?subject=Support%20Lajukan',
      title: isId ? 'Email support' : 'Email support',
      desc: isId
        ? 'Untuk bantuan akun, posting, pencarian supplier, dan verifikasi usaha.'
        : 'For account, posting, supplier search, and business verification help.',
      meta: 'support@lajukan.com',
      icon: Mail,
      external: true,
    },
    {
      href: businessPhoneHref,
      title: isId ? 'Telepon resmi' : 'Official phone',
      desc: isId
        ? 'Kontak bisnis resmi untuk bantuan penting dan verifikasi.'
        : 'Official business contact for important help and verification.',
      meta: businessPhone,
      icon: Phone,
      external: true,
    },
    {
      href: businessWhatsappHref,
      title: 'WhatsApp',
      desc: isId
        ? 'Jalur cepat untuk tanya status listing, pencarian supplier, atau kerja sama.'
        : 'Fast path for listing, supplier search, or partnership questions.',
      meta: businessPhone,
      icon: MessageCircle,
      external: true,
    },
    {
      href: '/chat',
      title: isId ? 'Live chat' : 'Live chat',
      desc: isId
        ? 'Buka chat untuk bantuan akun dan aktivitas di Lajukan.'
        : 'Talk directly with the Lajukan operations team.',
      meta: isId ? 'Buka chat' : 'Open chat',
      icon: MessageCircle,
      external: false,
    },
  ];

  return (
    <main className="page-shell page-rhythm pb-6 pt-4 lg:pb-8">
      <section className="ui-panel ui-hero-panel p-4">
        <p className="ui-page-eyebrow">
          {isId ? 'Pusat kontak' : 'Contact center'}
        </p>
        <h1 className="ui-page-title mt-2">
          {isId ? 'Butuh bantuan?' : 'Need help?'}
        </h1>
        <p className="ui-page-copy mt-2">
          {isId
            ? 'Hubungi tim Lajukan untuk bantuan akun, posting, pencarian supplier, atau verifikasi usaha.'
            : 'Contact the Lajukan team for account, posting, supplier search, or business verification help.'}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {channels.map(channel => {
            const Icon = channel.icon;
            const content = (
              <>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="mt-3 text-sm font-bold text-[color:var(--app-text)]">{channel.title}</h2>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {channel.desc}
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[color:var(--app-accent)]">
                  {channel.meta}
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </p>
              </>
            );

            return channel.external ? (
              <a key={channel.href} href={channel.href} className="ui-page-link-card p-3.5">
                {content}
              </a>
            ) : (
              <LocalizedLink key={channel.href} href={channel.href} className="ui-page-link-card p-3.5">
                {content}
              </LocalizedLink>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)] lg:grid-cols-3">
          <div>
            <p className="font-bold text-[color:var(--app-text)]">
              {isId ? 'Informasi bisnis' : 'Business information'}
            </p>
            <p className="mt-1 leading-6">
              {isId
                ? 'Lajukan membantu pengguna menemukan dan menawarkan mesin, bahan usaha, jasa, tempat usaha, serta profil usaha lokal.'
                : 'Lajukan helps users find and offer equipment, business supplies, services, business places, and local business profiles.'}
            </p>
          </div>
          <div>
            <p className="font-bold text-[color:var(--app-text)]">
              {isId ? 'Status pembayaran' : 'Payment status'}
            </p>
            <p className="mt-1 leading-6">
              {isId
                ? 'Untuk fase beta, komunikasi utama dilakukan lewat chat langsung. Pembayaran aman di Lajukan sedang disiapkan dan akan ditandai jelas saat aktif.'
                : 'During beta, communication mainly happens through direct chat. Secure Lajukan payments are being prepared and will be clearly marked when active.'}
            </p>
          </div>
          <div>
            <p className="font-bold text-[color:var(--app-text)]">
              {isId ? 'Kebijakan' : 'Policies'}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <LocalizedLink href="/terms" className="ui-button-secondary inline-flex min-h-9 items-center px-3 text-xs">
                {isId ? 'Syarat' : 'Terms'}
              </LocalizedLink>
              <LocalizedLink href="/privacy" className="ui-button-secondary inline-flex min-h-9 items-center px-3 text-xs">
                {isId ? 'Privasi' : 'Privacy'}
              </LocalizedLink>
              <LocalizedLink href="/refund-policy" className="ui-button-secondary inline-flex min-h-9 items-center px-3 text-xs">
                {isId ? 'Refund & retur' : 'Refunds & returns'}
              </LocalizedLink>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <LocalizedLink
            href="/support"
            className="ui-button-primary inline-flex items-center gap-2 px-4"
          >
            {isId ? 'Pusat bantuan' : 'Open help center'}
            <ArrowUpRight className="h-4 w-4" />
          </LocalizedLink>
          <LocalizedLink
            href="/trust"
            className="ui-button-secondary inline-flex items-center gap-2 px-4"
          >
            <ShieldCheck className="h-4 w-4" />
            {isId ? 'Trust center' : 'Trust center'}
          </LocalizedLink>
          <LocalizedLink
            href="/refund-policy"
            className="ui-button-secondary inline-flex items-center gap-2 px-4"
          >
            <ReceiptText className="h-4 w-4" />
            {isId ? 'Refund & retur' : 'Refunds & returns'}
          </LocalizedLink>
        </div>
      </section>
    </main>
  );
}
