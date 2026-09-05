import type { Metadata } from 'next';
import { Link } from '@/i18n/navigation';
import {
  ArrowRight,
  ClipboardList,
  Package,
  ShieldCheck,
  Store,
  Truck,
  Handshake,
  Globe,
  CheckCircle2,
} from 'lucide-react';
import { buildStaticPublicPageMetadata } from '@/lib/seo/publicStaticPageMetadata';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildStaticPublicPageMetadata('about', locale);
}

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const pillars = [
    { title: isId ? 'Cari & dapatkan pasokan' : 'Source anything faster', desc: isId ? 'Supplier, stok, bahan baku, sampai reseller — semua ketemu lebih cepat.' : 'Suppliers, raw materials, resale stock, and service providers in one connected flow.', icon: Package },
    { title: isId ? 'Operasional jadi jalan' : 'Operations that actually run', desc: isId ? 'Jasa, freelancer, toko, dan pengiriman langsung terkoneksi.' : 'Freelancers, services, storefronts, and delivery all work in one system.', icon: ClipboardList },
    { title: isId ? 'Transaksi aman & transparan' : 'Safe & verifiable transactions', desc: isId ? 'Chat langsung, bukti kerja, dan sinyal verifikasi dibuat jelas. Pembayaran aman sedang disiapkan bertahap.' : 'Direct chat, proof-of-work, and verification signals stay clear. Secure payments are being prepared gradually.', icon: ShieldCheck },
    { title: isId ? 'Bisnis yang bisa repeat' : 'Built for repeat business', desc: isId ? 'Bukan sekali transaksi — tapi siklus usaha yang terus jalan.' : 'Not one-time transactions, but repeatable business cycles.', icon: Truck },
  ] as const;
  const howItWorks = [
    { title: isId ? 'Temukan' : 'Discover', desc: isId ? 'Cari supplier, jasa, atau produk dalam hitungan detik.' : 'Find suppliers, services, and products instantly.', icon: Globe },
    { title: isId ? 'Hubungkan' : 'Connect', desc: isId ? 'Chat langsung, negosiasi, dan mulai kerja.' : 'Chat, negotiate, and start working immediately.', icon: Handshake },
    { title: isId ? 'Transaksi aman' : 'Secure transaction', desc: isId ? 'Cek profil, chat, bukti, dan status verifikasi sebelum lanjut.' : 'Check profile, chat, proof, and verification status before moving forward.', icon: ShieldCheck },
    { title: isId ? 'Ulangi & scale' : 'Repeat & scale', desc: isId ? 'Bangun relasi bisnis jangka panjang.' : 'Build long-term business relationships.', icon: CheckCircle2 },
  ] as const;
  return (
    <main className="page-shell page-rhythm pb-10 pt-8">
      <section className="ui-panel ui-hero-panel p-6 sm:p-10">
        <p className="ui-kicker"><Store className="h-3.5 w-3.5" />{isId ? 'Tentang Lajukan' : 'About Lajukan'}</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">{isId ? 'Satu tempat untuk jalankan bisnis.' : 'One place to run your business end-to-end.'}</h1>
        <p className="mt-4 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)] sm:text-base">{isId ? 'Lajukan membantu UMKM menemukan supplier, jasa, tempat usaha, dan peluang operasional dengan lebih rapi.' : 'Lajukan helps SMEs find suppliers, services, business places, and operational opportunities in a clearer flow.'}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/explore?type=products&q=supplier" className="ui-button-primary inline-flex items-center gap-2 px-5 text-sm">{isId ? 'Mulai cari supplier' : 'Start sourcing'}<ArrowRight className="h-4 w-4" /></Link>
          <Link href="/explore?type=businesses" className="ui-button-secondary inline-flex items-center gap-2 px-5 text-sm">{isId ? 'Lihat usaha' : 'Explore businesses'}</Link>
        </div>
      </section>
      <section className="ui-panel p-6 sm:p-8"><h2 className="text-xl font-bold">{isId ? 'Masalah yang kita selesaikan' : 'The problem we solve'}</h2><p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">{isId ? 'UMKM sering terpisah: cari supplier di satu tempat, jasa di tempat lain, kontak tidak jelas, dan informasi usaha sulit dicek.' : 'SMEs are fragmented: sourcing, services, unclear contacts, and business information are scattered across different places.'}</p></section>
      <section className="grid gap-3 sm:grid-cols-2">{pillars.map((item) => <article key={item.title} className="ui-panel p-5"><div className="flex items-center gap-3"><span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]"><item.icon className="h-5 w-5" /></span><h3 className="text-base font-semibold">{item.title}</h3></div><p className="mt-3 text-sm leading-6 text-[color:var(--app-text-soft)]">{item.desc}</p></article>)}</section>
      <section className="ui-panel p-6 sm:p-8"><h2 className="text-xl font-bold">{isId ? 'Cara kerja Lajukan' : 'How Lajukan works'}</h2><div className="mt-5 grid gap-3 sm:grid-cols-2">{howItWorks.map((item) => <div key={item.title} className="rounded-2xl border border-[color:var(--app-border)] p-4"><div className="flex items-center gap-3"><item.icon className="h-5 w-5 text-[color:var(--app-accent)]" /><h3 className="font-semibold">{item.title}</h3></div><p className="mt-2 text-sm text-[color:var(--app-text-soft)]">{item.desc}</p></div>)}</div></section>
      <section className="ui-panel p-6 sm:p-8"><h2 className="text-xl font-bold">{isId ? 'Kenapa harus percaya Lajukan?' : 'Why trust Lajukan?'}</h2><div className="mt-4 grid gap-2 text-sm text-[color:var(--app-text-soft)]"><p>• {isId ? 'Verifikasi pengguna & bisnis' : 'User and business verification'}</p><p>• {isId ? 'Pembayaran aman sedang disiapkan bertahap' : 'Secure payments are being prepared gradually'}</p><p>• {isId ? 'Chat & bukti kerja terintegrasi' : 'Built-in chat & proof of work'}</p><p>• {isId ? 'Audit transaksi transparan' : 'Transparent transaction history'}</p></div></section>
      <section className="ui-panel ui-hero-panel p-6 text-center sm:p-10"><h2 className="text-2xl font-bold">{isId ? 'Mulai bangun bisnis yang lebih rapi.' : 'Start building a more structured business.'}</h2><p className="mt-3 text-sm text-[color:var(--app-text-soft)]">{isId ? 'Cari supplier, jasa, tempat usaha, dan peluang dengan alur yang lebih sederhana.' : 'Find suppliers, services, business places, and opportunities in a simpler flow.'}</p><div className="mt-6"><Link href="/explore" className="ui-button-primary inline-flex items-center gap-2 px-6 text-sm">{isId ? 'Mulai sekarang' : 'Get started'}<ArrowRight className="h-4 w-4" /></Link></div></section>
    </main>
  );
}
