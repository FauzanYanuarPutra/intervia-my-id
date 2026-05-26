import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string; orderId: string }>;
};

export default async function LegacySuperAppTrackerPage({ params }: PageProps) {
  const { locale, orderId } = await params;
  redirect(`/${locale}/transactions/${encodeURIComponent(orderId)}`);
}
