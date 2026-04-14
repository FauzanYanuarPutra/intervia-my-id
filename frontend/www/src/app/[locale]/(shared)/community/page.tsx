import { Link } from '@/i18n/navigation';
import { ArrowRight, MessageCircle, Package, ShieldCheck, Users } from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CommunityPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  const circles = [
    {
      title: isId ? 'Circle supplier & distributor' : 'Supplier and distributor circle',
      desc: isId
        ? 'Tempat berbagi vendor yang benar-benar responsif, harga partai, dan kualitas yang stabil.'
        : 'A place to share vendors that are actually responsive, priced for wholesale, and consistent in quality.',
      cta: isId ? 'Masuk circle sourcing' : 'Enter sourcing circle',
      href: '/search?type=product&q=distributor',
    },
    {
      title: isId ? 'Circle seller & channel online' : 'Seller and online channel circle',
      desc: isId
        ? 'Bahas Shopee, Tokopedia, TikTok Shop, packaging, promosi, dan ritme repeat order.'
        : 'Talk about Shopee, Tokopedia, TikTok Shop, packaging, promotions, and repeat-order rhythm.',
      cta: isId ? 'Buka topik channel' : 'Open channel topics',
      href: '/search?type=service&q=optimasi%20marketplace',
    },
    {
      title: isId ? 'Circle eksekusi operasional' : 'Operational execution circle',
      desc: isId
        ? 'Cari admin marketplace, content operator, CS, kurir, dan support harian lain.'
        : 'Find marketplace admins, content operators, CS, couriers, and other daily support.',
      cta: isId ? 'Cari support harian' : 'Find daily support',
      href: '/search?type=freelancer&q=admin%20marketplace',
    },
    {
      title: isId ? 'Circle harga sehat & margin' : 'Healthy pricing and margin circle',
      desc: isId
        ? 'Bahas HPP, margin, repeat order, dan cara jual tanpa saling banting harga.'
        : 'Discuss cost structure, margins, repeat orders, and how to sell without destructive price wars.',
      cta: isId ? 'Belajar harga sehat' : 'Learn healthy pricing',
      href: '/learn',
    },
  ] as const;

  const board = [
    isId ? 'Supplier packaging yang responnya paling cepat?' : 'Which packaging suppliers respond the fastest?',
    isId ? 'Bahan baku apa yang aman dibeli partai kecil dulu?' : 'Which raw materials are safe to buy in small batches first?',
    isId ? 'Paket bundling apa yang bikin dua UMKM sama-sama laku?' : 'Which bundles help two small businesses sell together?',
    isId ? 'Kurir mana yang paling cocok untuk repeat order?' : 'Which courier flow works best for repeat orders?',
  ];

  const principles = [
    isId ? 'Jangan jual rugi demi ramai sesaat.' : 'Do not sell at a loss for short-term traffic.',
    isId ? 'Bagikan supplier yang benar-benar terbukti.' : 'Share suppliers that are actually reliable.',
    isId ? 'Cari bundling dan promosi silang, bukan saling jatuhkan.' : 'Use bundles and cross-promotion instead of destructive rivalry.',
    isId ? 'Naik kelas bareng: kualitas, margin, repeat order.' : 'Level up together through quality, margin, and repeat orders.',
  ];

  return (
    <main className="page-shell page-rhythm py-8">
      <section className="ui-panel ui-hero-panel rounded-3xl p-6">
        <p className="ui-kicker">
          <Users className="h-3.5 w-3.5" />
          {isId ? 'Komunitas usaha' : 'Business community'}
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-[color:var(--app-text)]">
          {isId
            ? 'Bukan cuma listing. Kita butuh pasar yang saling menguatkan.'
            : 'Not just listings. We need a market that strengthens each other.'}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId
            ? 'Insight terbaik usaha sering datang dari pelaku lain: supplier mana yang konsisten, channel mana yang lagi naik, jasa mana yang benar-benar bantu closing, dan cara tumbuh tanpa perang harga.'
            : 'The best business insight often comes from other operators: which suppliers stay consistent, which channels are rising, which services actually help close deals, and how to grow without price wars.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/forum" className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
            {isId ? 'Masuk forum bisnis' : 'Open business forum'}
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/reels" className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
            {isId ? 'Lihat reels usaha' : 'Browse business reels'}
          </Link>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          {circles.map((item) => (
            <article key={item.title} className="ui-panel rounded-3xl p-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                  <Users className="h-4.5 w-4.5" />
                </span>
                <div>
                  <h2 className="text-base font-semibold text-[color:var(--app-text)]">
                    {item.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                    {item.desc}
                  </p>
                </div>
              </div>
              <Link href={item.href} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold ui-accent-text">
                {item.cta}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>

        <div className="space-y-4">
          <article className="ui-panel rounded-3xl p-5">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4.5 w-4.5 text-[color:var(--app-accent)]" />
              <h2 className="text-base font-semibold text-[color:var(--app-text)]">
                {isId ? 'Obrolan yang perlu ada' : 'Conversations that should exist'}
              </h2>
            </div>
            <div className="mt-4 space-y-2">
              {board.map((item) => (
                <div
                  key={item}
                  className="ui-panel-muted rounded-2xl border border-[color:var(--app-border)] px-3 py-3 text-sm text-[color:var(--app-text-soft)]"
                >
                  {item}
                </div>
              ))}
            </div>
          </article>

          <article className="ui-panel rounded-3xl p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4.5 w-4.5 text-[color:var(--app-accent)]" />
              <h2 className="text-base font-semibold text-[color:var(--app-text)]">
                {isId ? 'Aturan gotong royong' : 'Gotong royong principles'}
              </h2>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[color:var(--app-text-soft)]">
              {principles.map((item) => (
                <div key={item} className="ui-inline-meta ui-border">
                  <Package className="h-3.5 w-3.5" />
                  {item}
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
