import {
  Ban,
  CreditCard,
  FileText,
  Handshake,
  PhoneCall,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  TERMS_SECTIONS,
  TRUST_LAST_UPDATED,
  pickText,
} from '@/data/trustCenter';
import {
  AnchorLink,
  InfoChips,
  LegalSectionView,
  SummaryCard,
} from '@/components/trust/TrustUI';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function TermsPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const principles = [
    {
      icon: ShieldCheck,
      text: isId
        ? 'Status setiap fitur harus dijelaskan dengan jujur.'
        : 'Every feature status must be explained clearly.',
    },
    {
      icon: Handshake,
      text: isId
        ? 'Pembeli dan penjual wajib bertransaksi dengan jujur.'
        : 'Buyers and sellers must transact honestly.',
    },
    {
      icon: FileText,
      text: isId
        ? 'Setiap listing dan chat harus bisa dipertanggungjawabkan.'
        : 'Listings and chats must be accountable.',
    },
    {
      icon: Ban,
      text: isId
        ? 'Penipuan, spam, dan aktivitas ilegal tidak diperbolehkan.'
        : 'Fraud, spam, and illegal activity are not allowed.',
    },
  ];
  const meaning = isId
    ? [
        'Kamu boleh mencari, menawarkan, dan menghubungi kebutuhan usaha.',
        'Transaksi terbaik dilakukan dengan bukti dan komunikasi yang jelas.',
        'Simpan bukti harga, jadwal, dan kesepakatan di chat.',
        'Pelanggaran dapat membuat konten atau akun dibatasi.',
      ]
    : [
        'You can search, offer, and contact business needs.',
        'Good transactions use clear proof and communication.',
        'Keep price, schedule, and agreement evidence in chat.',
        'Violations may restrict content or accounts.',
      ];
  const related = [
    {
      icon: CreditCard,
      title: isId ? 'Pembayaran' : 'Payments',
      body: isId
        ? 'Fitur pembayaran atau escrow hanya berlaku bila status aktif tampil jelas pada transaksi.'
        : 'Payment or escrow applies only when an active status is clearly shown on the transaction.',
      href: '/trust/payments',
      cta: isId ? 'Baca pembayaran' : 'Read payments',
    },
    {
      icon: RotateCcw,
      title: isId ? 'Refund & retur' : 'Refunds & returns',
      body: isId
        ? 'Saat pembayaran platform belum aktif, pembatalan, komplain, dan retur mengikuti kesepakatan antar pihak.'
        : 'When platform payment is not active, cancellations, complaints, and returns follow the parties’ agreement.',
      href: '/refund-policy',
      cta: isId ? 'Buka kebijakan' : 'Open policy',
    },
    {
      icon: PhoneCall,
      title: isId ? 'Kontak bantuan' : 'Support contact',
      body: isId
        ? 'Butuh bantuan transaksi, listing, atau verifikasi? Hubungi support.'
        : 'Need help with transactions, listings, or verification? Contact support.',
      href: '/contact',
      cta: isId ? 'Hubungi kami' : 'Contact us',
    },
  ];

  return (
    <main className="page-shell page-shell-readable page-rhythm pb-10 pt-4">
      <SummaryCard
        title={isId ? 'Aturan penggunaan Lajukan' : 'Lajukan Terms of Service'}
        description={
          isId
            ? 'Aturan ini menjelaskan penggunaan pencarian, listing, chat, kesepakatan, serta batas layanan pembayaran Lajukan.'
            : 'These terms explain search, listings, chat, agreements, and the limits of Lajukan payment services.'
        }
        meta={isId ? 'Syarat & ketentuan' : 'Terms'}
      >
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {principles.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.text}
                className="flex items-start gap-2 rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2 text-sm text-[color:var(--app-text-soft)]"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                <span>{item.text}</span>
              </div>
            );
          })}
        </div>

        <InfoChips
          items={[
            isId ? 'Hak & kewajiban' : 'Rights & duties',
            isId ? 'Aturan transaksi' : 'Transaction rules',
            isId ? 'Pelarangan' : 'Prohibited activity',
            isId ? 'Penyelesaian masalah' : 'Issue resolution',
          ]}
        />

        <div className="flex flex-wrap gap-2">
          {TERMS_SECTIONS.map(section => (
            <AnchorLink
              key={section.id}
              href={`#${section.id}`}
              label={pickText(locale, section.title)}
            />
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/trust"
            className="ui-button-secondary inline-flex items-center px-4 text-sm"
          >
            {isId ? 'Pusat keamanan' : 'Trust Center'}
          </Link>
          <Link
            href="/privacy"
            className="ui-button-secondary inline-flex items-center px-4 text-sm"
          >
            {isId ? 'Privasi' : 'Privacy Policy'}
          </Link>
        </div>
      </SummaryCard>

      <section className="text-xs text-[color:var(--app-text-soft)]">
        {isId ? 'Terakhir diperbarui' : 'Last updated'}:{' '}
        {pickText(locale, TRUST_LAST_UPDATED)}
      </section>

      <section className="ui-panel rounded-[24px] p-5">
        <h2 className="text-lg font-bold text-[color:var(--app-text)]">
          {isId ? 'Artinya untuk kamu' : 'What this means for you'}
        </h2>
        <div className="mt-4 grid gap-2 text-sm text-[color:var(--app-text-soft)] sm:grid-cols-2">
          {meaning.map(item => (
            <p
              key={item}
              className="rounded-[16px] bg-[color:var(--app-surface-muted)] px-3 py-2"
            >
              {item}
            </p>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {related.map(item => {
          const Icon = item.icon;
          return (
            <Link
              key={item.title}
              href={item.href}
              className="ui-panel ui-card-hover rounded-[22px] p-5"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[15px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-bold text-[color:var(--app-text)]">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {item.body}
              </p>
              <span className="mt-4 inline-flex text-xs font-bold text-[color:var(--app-accent)]">
                {item.cta}
              </span>
            </Link>
          );
        })}
      </section>

      <section className="space-y-3">
        {TERMS_SECTIONS.map(section => (
          <div key={section.id} id={section.id} className="scroll-mt-24">
            <LegalSectionView
              section={section}
              locale={locale as 'id' | 'en'}
            />
          </div>
        ))}
      </section>

      <section className="ui-panel ui-hero-panel rounded-[24px] p-6 text-center sm:p-8">
        <h3 className="text-lg font-bold text-[color:var(--app-text)]">
          {isId
            ? 'Gunakan Lajukan dengan aman dan bertanggung jawab.'
            : 'Use Lajukan safely and responsibly.'}
        </h3>
        <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
          {isId
            ? 'Periksa status fitur pada halaman transaksi dan simpan bukti kesepakatan sebelum membayar.'
            : 'Check the feature status on the transaction page and keep agreement evidence before paying.'}
        </p>
      </section>
    </main>
  );
}
