import TrackerClient from './tracker-client';

type PageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

export default async function SuperAppTrackerPage({ params }: PageProps) {
  const { locale, orderId } = await params;
  return <TrackerClient locale={locale} orderId={orderId} />;
}
