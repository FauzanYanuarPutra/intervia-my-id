import { HomeContentSimple } from '@/components/home/HomeContentSimple';
import { Link } from '@/i18n/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <>
      <section className="page-shell pt-4 sm:pt-6" aria-labelledby="home-value-proposition">
        <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-5 py-6 shadow-sm sm:px-7 sm:py-8">
          <p className="ui-page-eyebrow">
            {isId ? 'Jelas kebutuhannya, tepat mitranya.' : 'Clear needs. The right business match.'}
          </p>
          <h1 id="home-value-proposition" className="mt-2 max-w-4xl text-2xl font-bold leading-tight tracking-tight text-[color:var(--app-text)] sm:text-4xl">
            {isId
              ? 'Cari supplier, jasa, mesin, dan kebutuhan usaha dalam satu tempat.'
              : 'Find suppliers, services, equipment, and business needs in one place.'}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)] sm:text-base">
            {isId
              ? 'Temukan yang dibutuhkan usahamu atau pasang kebutuhan agar penyedia yang tepat bisa menemukanmu.'
              : 'Find what your business needs, or post a need so the right providers can find you.'}
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link href="/explore" className="ui-button-primary inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold">
              {isId ? 'Cari kebutuhan usaha' : 'Explore business needs'}
            </Link>
            <Link href="/create?side=demand" className="ui-button-secondary inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold">
              {isId ? 'Pasang kebutuhan' : 'Post a need'}
            </Link>
          </div>
        </div>
      </section>
      <HomeContentSimple locale={locale} />
    </>
  );
}
