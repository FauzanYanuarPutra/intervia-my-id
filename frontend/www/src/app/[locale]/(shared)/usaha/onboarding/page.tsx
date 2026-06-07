import { UsahaOwnerRouteView } from '../_components/UsahaOwnerRouteView';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function UsahaOnboardingPage({
  params,
}: PageProps) {
  const { locale } = await params;
  return (
    <UsahaOwnerRouteView
      locale={locale}
      workspace="setup"
      setupView="create"
    />
  );
}
