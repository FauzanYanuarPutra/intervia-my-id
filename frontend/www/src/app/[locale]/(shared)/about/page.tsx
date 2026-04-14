import { Link } from '@/i18n/navigation';
import { ArrowRight, ClipboardList, Package, ShieldCheck, Store, Truck } from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function AboutPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  const pillars = [
    {
      title: isId ? 'Sourcing yang lebih masuk akal' : 'Smarter sourcing',
      desc: isId
        ? 'Supplier, distributor, bahan baku, stok reseller, dan lokasi jualan dikumpulkan ke flow yang lebih cepat.'
        : 'Suppliers, distributors, raw materials, resale stock, and selling locations are brought into a faster flow.',
      icon: Package,
    },
    {
      title: isId ? 'Operasional yang bisa dijalankan' : 'Operational execution',
      desc: isId
        ? 'Jasa operasional, freelancer, storefront usaha, dan pengiriman order dibuat saling nyambung.'
        : 'Operational services, freelancers, business storefronts, and order delivery are designed to connect together.',
      icon: ClipboardList,
    },
    {
      title: isId ? 'Trust yang terasa nyata' : 'Practical trust',
      desc: isId
        ? 'Verifikasi, escrow, audit trail, chat, dan bukti transaksi dijaga dekat ke aksi utama.'
        : 'Verification, escrow, audit trails, chat, and transaction proof stay close to the main action.',
      icon: ShieldCheck,
    },
    {
      title: isId ? 'Pertumbuhan yang berulang' : 'Repeatable growth',
      desc: isId
        ? 'Targetnya bukan transaksi sekali jalan, tapi ritme bisnis yang bisa diulang setiap hari.'
        : 'The goal is not a one-off transaction, but a business rhythm that can repeat every day.',
      icon: Truck,
    },
  ] as const;

  return (
    <main className="page-shell page-rhythm pb-24 pt-6 lg:pb-10">
      <section className="ui-panel ui-hero-panel p-6 sm:p-8">
        <p className="ui-kicker">
          <Store className="h-3.5 w-3.5" />
          {isId ? 'Tentang Lajukan' : 'About Lajukan'}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[color:var(--app-text)] sm:text-4xl">
          {isId
            ? 'Lajukan dibangun untuk membuat usaha lebih mudah jalan.'
            : 'Lajukan is built to make businesses easier to run.'}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Kami tidak ingin jadi marketplace umum yang terlalu lebar. Fokus Lajukan adalah membantu usaha menemukan pasokan, menjalankan operasional, membuka storefront, dan menjaga transaksi tetap aman.'
            : 'We do not want to be a broad generic marketplace. Lajukan focuses on helping businesses find supply, run operations, open storefronts, and keep transactions safe.'}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/search?type=product&q=supplier" className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm">
            {isId ? 'Cari supplier' : 'Find suppliers'}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/super-app" className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm">
            {isId ? 'Buka super app usaha' : 'Open business super app'}
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {pillars.map((item) => (
          <article key={item.title} className="ui-panel p-4">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              <item.icon className="h-4.5 w-4.5" />
            </span>
            <h2 className="mt-3 text-base font-semibold text-[color:var(--app-text)]">
              {item.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
              {item.desc}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
