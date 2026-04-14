import { redirect } from 'next/navigation';

export default async function MarketplacePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?type=product&q=supplier`);
}
