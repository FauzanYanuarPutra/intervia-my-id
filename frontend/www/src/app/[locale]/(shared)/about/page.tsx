import { Link } from '@/i18n/navigation';
import {
  ArrowRight,
  ClipboardList,
  Package,
  ShieldCheck,
  Store,
  Truck,
  Users,
  Handshake,
  Globe,
  CheckCircle2,
} from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  const pillars = [
    {
      title: isId ? 'Cari & dapatkan pasokan' : 'Source anything faster',
      desc: isId
        ? 'Supplier, stok, bahan baku, sampai reseller — semua ketemu lebih cepat.'
        : 'Suppliers, raw materials, resale stock, and service providers in one connected flow.',
      icon: Package,
    },
    {
      title: isId ? 'Operasional jadi jalan' : 'Operations that actually run',
      desc: isId
        ? 'Jasa, freelancer, toko, dan pengiriman langsung terkoneksi.'
        : 'Freelancers, services, storefronts, and delivery all work in one system.',
      icon: ClipboardList,
    },
    {
      title: isId ? 'Transaksi aman & transparan' : 'Safe & verifiable transactions',
      desc: isId
        ? 'Chat, escrow, bukti kerja, dan verifikasi di satu tempat.'
        : 'Chat, escrow, proof-of-work, and verification built into every transaction.',
      icon: ShieldCheck,
    },
    {
      title: isId ? 'Bisnis yang bisa repeat' : 'Built for repeat business',
      desc: isId
        ? 'Bukan sekali transaksi — tapi siklus usaha yang terus jalan.'
        : 'Not one-time transactions, but repeatable business cycles.',
      icon: Truck,
    },
  ] as const;

  const howItWorks = [
    {
      title: isId ? 'Temukan' : 'Discover',
      desc: isId
        ? 'Cari supplier, jasa, atau produk dalam hitungan detik.'
        : 'Find suppliers, services, and products instantly.',
      icon: Globe,
    },
    {
      title: isId ? 'Hubungkan' : 'Connect',
      desc: isId
        ? 'Chat langsung, negosiasi, dan mulai kerja.'
        : 'Chat, negotiate, and start working immediately.',
      icon: Handshake,
    },
    {
      title: isId ? 'Transaksi aman' : 'Secure transaction',
      desc: isId
        ? 'Escrow & verifikasi melindungi kedua pihak.'
        : 'Escrow and verification protect both sides.',
      icon: ShieldCheck,
    },
    {
      title: isId ? 'Ulangi & scale' : 'Repeat & scale',
      desc: isId
        ? 'Bangun relasi bisnis jangka panjang.'
        : 'Build long-term business relationships.',
      icon: CheckCircle2,
    },
  ] as const;

  return (
    <main className="page-shell page-rhythm pb-10 pt-8">

      {/* HERO */}
      <section className="ui-panel ui-hero-panel p-6 sm:p-10">
        <p className="ui-kicker">
          <Store className="h-3.5 w-3.5" />
          {isId ? 'Tentang Lajukan' : 'About Lajukan'}
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
          {isId
            ? 'Satu tempat untuk jalankan bisnis.'
            : 'One place to run your business end-to-end.'}
        </h1>

        <p className="mt-4 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)] sm:text-base">
          {isId
            ? 'Lajukan membantu UMKM menemukan supplier, menjalankan operasional, dan melakukan transaksi aman tanpa ribet.'
            : 'Lajukan connects sourcing, operations, and secure transactions into a single business flow for SMEs and freelancers.'}
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/search?type=product&q=supplier"
            className="ui-button-primary inline-flex items-center gap-2 px-5 text-sm"
          >
            {isId ? 'Mulai cari supplier' : 'Start sourcing'}
            <ArrowRight className="h-4 w-4" />
          </Link>

          <Link
            href="/umkm"
            className="ui-button-secondary inline-flex items-center gap-2 px-5 text-sm"
          >
            {isId ? 'Lihat usaha' : 'Explore businesses'}
          </Link>
        </div>
      </section>

      {/* PROBLEM / CONTEXT */}
      <section className="ui-panel p-6 sm:p-8">
        <h2 className="text-xl font-bold">
          {isId ? 'Masalah yang kita selesaikan' : 'The problem we solve'}
        </h2>
        <p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'UMKM sering terpisah: cari supplier di satu tempat, jasa di tempat lain, transaksi tidak aman, dan operasional tidak terhubung.'
            : 'SMEs are fragmented: sourcing, services, and transactions are scattered across different platforms with no trust layer.'}
        </p>
      </section>

      {/* PILLARS */}
      <section className="grid gap-3 sm:grid-cols-2">
        {pillars.map((item) => (
          <article key={item.title} className="ui-panel p-5">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                <item.icon className="h-5 w-5" />
              </span>
              <h3 className="text-base font-semibold">{item.title}</h3>
            </div>
            <p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">
              {item.desc}
            </p>
          </article>
        ))}
      </section>

      {/* HOW IT WORKS */}
      <section className="ui-panel p-6 sm:p-8">
        <h2 className="text-xl font-bold">
          {isId ? 'Cara kerja Lajukan' : 'How Lajukan works'}
        </h2>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {howItWorks.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[color:var(--app-border)] p-4">
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-[color:var(--app-accent)]" />
                <h3 className="font-semibold">{item.title}</h3>
              </div>
              <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST SECTION */}
      <section className="ui-panel p-6 sm:p-8">
        <h2 className="text-xl font-bold">
          {isId ? 'Kenapa harus percaya Lajukan?' : 'Why trust Lajukan?'}
        </h2>

        <div className="mt-4 grid gap-2 text-sm text-[color:var(--app-text-soft)]">
          <p>• {isId ? 'Verifikasi pengguna & bisnis' : 'User and business verification'}</p>
          <p>• {isId ? 'Escrow untuk transaksi aman' : 'Escrow for safe transactions'}</p>
          <p>• {isId ? 'Chat & bukti kerja terintegrasi' : 'Built-in chat & proof of work'}</p>
          <p>• {isId ? 'Audit transaksi transparan' : 'Transparent transaction history'}</p>
        </div>
      </section>

      {/* CTA */}
      <section className="ui-panel ui-hero-panel p-6 sm:p-10 text-center">
        <h2 className="text-2xl font-bold">
          {isId
            ? 'Mulai bangun bisnis yang lebih rapi.'
            : 'Start building a more structured business.'}
        </h2>

        <p className="mt-3 text-sm text-[color:var(--app-text-soft)]">
          {isId
            ? 'Cari supplier, jalankan operasional, dan transaksi dengan aman dalam satu platform.'
            : 'Source, operate, and transact securely in one connected system.'}
        </p>

        <div className="mt-6">
          <Link
            href="/search"
            className="ui-button-primary inline-flex items-center gap-2 px-6 text-sm"
          >
            {isId ? 'Mulai sekarang' : 'Get started'}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

    </main>
  );
}