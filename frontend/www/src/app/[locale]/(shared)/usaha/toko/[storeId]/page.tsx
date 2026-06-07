import { UsahaOwnerRouteView } from '../../_components/UsahaOwnerRouteView';

type PageProps = {
  params: Promise<{ locale: string; storeId: string }>;
};

export default async function UsahaStoreIndexPage({ params }: PageProps) {
  const { locale, storeId } = await params;
  return <UsahaOwnerRouteView locale={locale} forcedStoreId={storeId} />;
}
