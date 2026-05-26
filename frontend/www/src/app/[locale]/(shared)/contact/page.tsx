// app/[locale]/contact/page.tsx
import { Metadata } from 'next';
import { LocalizedLink } from '@/components/ui-kit';
import { ArrowUpRight, Mail, MessageCircle, Phone, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Hubungi Kami | Lajukan',
  description:
    'Kontak cepat untuk supplier, transaksi, dan usaha.',
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

  const channels = [
    {
      href: 'mailto:support@lajukan.com?subject=Support%20Lajukan',
      title: isId ? 'Email support' : 'Email support',
      desc: isId
        ? 'Supplier, transaksi, usaha.'
        : 'For supplier, transaction, and business operation tickets.',
      meta: 'support@lajukan.com',
      icon: Mail,
      external: true,
    },
    {
      href: 'tel:+622112345678',
      title: isId ? 'Hotline' : 'Hotline',
      desc: isId
        ? 'Mendesak.'
        : 'For urgent issues, quick verification, and sensitive cases.',
      meta: '+62 21 1234 5678',
      icon: Phone,
      external: true,
    },
    {
      href: '/chat',
      title: isId ? 'Live chat' : 'Live chat',
      desc: isId
        ? 'Langsung chat.'
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
          {isId ? 'Butuh bantuan?' : 'Need help? Pick the fastest path.'}
        </h1>
        <p className="ui-page-copy mt-2">
          {isId
            ? 'Pilih jalur. Tulis singkat.'
            : 'Start from the closest context: suppliers, transactions, storefronts, or trust. Keep it short so the team can act quickly.'}
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {channels.map(channel => {
            const Icon = channel.icon;
            const content = (
              <>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-[13px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Icon className="h-4 w-4" />
                </span>
                <h2 className="mt-3 text-sm font-black text-[color:var(--app-text)]">{channel.title}</h2>
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
        </div>
      </section>
    </main>
  );
}
