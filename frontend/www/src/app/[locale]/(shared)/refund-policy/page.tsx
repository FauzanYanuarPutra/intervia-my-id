import { Link } from '@/i18n/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  MessageCircle,
  PackageCheck,
  Phone,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

const businessPhoneDisplay = '0821 1714 8623';
const businessPhoneHref = 'tel:+6282117148623';
const businessWhatsappHref = 'https://wa.me/6282117148623';

export default async function RefundPolicyPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  const policyCards = [
    {
      icon: CreditCard,
      title: isId ? 'Mata uang transaksi' : 'Transaction currency',
      body: isId
        ? 'Semua harga, biaya layanan, pembayaran, pembatalan, dan refund yang aktif memakai Rupiah (IDR).'
        : 'All active prices, service fees, payments, cancellations, and refunds use Indonesian Rupiah (IDR).',
    },
    {
      icon: ReceiptText,
      title: isId ? 'Pembayaran' : 'Payments',
      body: isId
        ? 'Pembayaran diproses dari halaman Lajukan. Pengguna tidak diminta membayar lewat instruksi transfer di luar platform.'
        : 'Payments are processed from Lajukan pages. Users are not asked to pay through off-platform transfer instructions.',
    },
    {
      icon: PackageCheck,
      title: isId ? 'Produk dan jasa' : 'Products and services',
      body: isId
        ? 'Listing dapat berupa produk, supplier, jasa, lokasi usaha, rental alat, atau profil usaha yang bisa ditanyakan lewat chat.'
        : 'Listings may include products, suppliers, services, business locations, tool rentals, or business profiles that can be discussed through chat.',
    },
  ];

  const refundRules = [
    {
      icon: RotateCcw,
      title: isId ? 'Pembatalan sebelum diproses' : 'Cancellation before processing',
      body: isId
        ? 'Jika pesanan atau permintaan belum diproses oleh penyedia, pengguna dapat meminta pembatalan lewat chat atau support.'
        : 'If an order or request has not been processed by the provider, users may request cancellation through chat or support.',
    },
    {
      icon: AlertCircle,
      title: isId ? 'Produk tidak sesuai' : 'Item not as described',
      body: isId
        ? 'Untuk produk fisik, retur diproses jika barang rusak, salah kirim, atau tidak sesuai deskripsi yang dipublikasikan.'
        : 'For physical products, returns are handled when items are damaged, wrongly delivered, or materially different from the published description.',
    },
    {
      icon: ShieldCheck,
      title: isId ? 'Layanan tidak berjalan' : 'Service not delivered',
      body: isId
        ? 'Untuk jasa, komplain ditinjau dari bukti chat, brief, scope, dan progres pekerjaan yang disepakati.'
        : 'For services, complaints are reviewed based on chat evidence, briefs, scope, and agreed work progress.',
    },
    {
      icon: Clock3,
      title: isId ? 'Estimasi penanganan' : 'Review timeline',
      body: isId
        ? 'Tim Lajukan meninjau permintaan refund/retur secepatnya setelah data lengkap diterima.'
        : 'The Lajukan team reviews refund and return requests as soon as the required information is complete.',
    },
  ];

  const evidenceItems = isId
    ? [
        'Nomor akun atau nomor HP yang dipakai.',
        'Link listing, room chat, atau ID transaksi bila ada.',
        'Kronologi singkat dan bukti foto/video jika relevan.',
        'Nominal pembayaran dalam Rupiah (IDR) bila transaksi sudah aktif.',
      ]
    : [
        'Account number or phone number used.',
        'Listing link, chat room, or transaction ID if available.',
        'Short chronology and photo/video proof when relevant.',
        'Payment amount in Indonesian Rupiah (IDR) when a transaction is active.',
      ];

  return (
    <main className="page-shell page-rhythm pb-10 pt-6">
      <section className="ui-panel ui-hero-panel overflow-hidden rounded-[28px] p-5 sm:p-7">
        <p className="ui-page-eyebrow">
          {isId ? 'Kebijakan transaksi' : 'Transaction policy'}
        </p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div>
            <h1 className="ui-page-title">
              {isId
                ? 'Kebijakan refund, retur, dan pembatalan'
                : 'Refund, return, and cancellation policy'}
            </h1>
            <p className="ui-page-copy mt-3 max-w-3xl">
              {isId
                ? 'Halaman ini menjelaskan cara Lajukan menangani pengembalian dana, retur produk, komplain layanan, dan kontak bisnis resmi. Untuk fase listing, komunikasi utama dilakukan lewat chat; saat transaksi aktif, pembayaran tetap diproses dalam Rupiah dari halaman Lajukan.'
                : 'This page explains how Lajukan handles refunds, product returns, service complaints, and official business contact. During the listing phase, communication happens mainly through chat; when transactions are active, payments are processed in Rupiah from Lajukan pages.'}
            </p>
          </div>

          <aside className="rounded-[22px] border border-[color:var(--app-border)] bg-white/82 p-4 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/50">
            <p className="text-sm font-black text-[color:var(--app-text)]">
              {isId ? 'Kontak bisnis resmi' : 'Official business contact'}
            </p>
            <a
              href={businessPhoneHref}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-black text-white"
            >
              <Phone className="h-4 w-4" />
              {businessPhoneDisplay}
            </a>
            <a
              href={businessWhatsappHref}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 text-sm font-black text-[color:var(--app-accent)]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
            <p className="mt-3 text-xs leading-5 text-[color:var(--app-text-soft)]">
              support@lajukan.com
            </p>
          </aside>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {policyCards.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.title} className="ui-panel rounded-[22px] p-5">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[15px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <h2 className="mt-4 text-base font-black text-[color:var(--app-text)]">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                {item.body}
              </p>
            </div>
          );
        })}
      </section>

      <section className="ui-panel rounded-[24px] p-5 sm:p-6">
        <h2 className="text-lg font-black text-[color:var(--app-text)]">
          {isId ? 'Kapan refund atau retur bisa diajukan?' : 'When can refunds or returns be requested?'}
        </h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {refundRules.map(item => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)]"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-white text-[color:var(--app-accent)] shadow-sm dark:bg-slate-950/60">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-[color:var(--app-text)]">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-[color:var(--app-text-soft)]">
                      {item.body}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="ui-panel rounded-[24px] p-5 sm:p-6">
          <h2 className="text-lg font-black text-[color:var(--app-text)]">
            {isId ? 'Data yang perlu disiapkan' : 'Information to prepare'}
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-[color:var(--app-text-soft)]">
            {evidenceItems.map(item => (
              <li key={item} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="ui-panel rounded-[24px] p-5 sm:p-6">
          <h2 className="text-lg font-black text-[color:var(--app-text)]">
            {isId ? 'Catatan penting' : 'Important notes'}
          </h2>
          <div className="mt-4 grid gap-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
            <p>
              {isId
                ? 'Jika transaksi belum dibayar melalui sistem Lajukan, Lajukan hanya dapat membantu mediasi komunikasi berdasarkan bukti yang tersedia.'
                : 'If a transaction has not been paid through the Lajukan system, Lajukan can only help mediate communication based on available evidence.'}
            </p>
            <p>
              {isId
                ? 'Refund yang sudah disetujui akan dikembalikan melalui jalur pembayaran yang tersedia dan dicatat dalam sistem.'
                : 'Approved refunds are returned through the available payment flow and recorded in the system.'}
            </p>
            <p>
              {isId
                ? 'Pengguna dilarang meminta pembayaran di luar instruksi resmi Lajukan.'
                : 'Users must not request payment outside official Lajukan instructions.'}
            </p>
          </div>
        </div>
      </section>

      <section className="ui-panel rounded-[24px] p-5 text-center sm:p-6">
        <h2 className="text-lg font-black text-[color:var(--app-text)]">
          {isId ? 'Butuh bantuan soal refund atau retur?' : 'Need help with a refund or return?'}
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Mulai dari kontak bisnis atau buat tiket support. Sertakan link listing, room chat, dan bukti yang relevan agar tim bisa memeriksa lebih cepat.'
            : 'Start from the business contact or create a support ticket. Include the listing link, chat room, and relevant proof so the team can review faster.'}
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/contact" className="ui-button-primary inline-flex items-center px-5 text-sm">
            {isId ? 'Hubungi Lajukan' : 'Contact Lajukan'}
          </Link>
          <Link href="/support" className="ui-button-secondary inline-flex items-center px-5 text-sm">
            {isId ? 'Buat tiket support' : 'Create support ticket'}
          </Link>
          <Link href="/terms" className="ui-button-secondary inline-flex items-center px-5 text-sm">
            {isId ? 'Baca ketentuan' : 'Read terms'}
          </Link>
        </div>
      </section>
    </main>
  );
}
