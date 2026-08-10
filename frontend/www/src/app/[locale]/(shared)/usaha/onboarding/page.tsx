import { UsahaOwnerRouteView } from '../_components/UsahaOwnerRouteView';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function UsahaOnboardingPage({
  params,
}: PageProps) {
  const { locale } = await params;
  return (
    <main className="min-h-0 w-full min-w-0">
      <div className="page-shell w-full min-w-0 py-4 sm:py-5 lg:py-6">
        <UsahaOwnerRouteView
          locale={locale}
          workspace="setup"
          setupView="create"
        />
      </div>
    </main>
  );
}
