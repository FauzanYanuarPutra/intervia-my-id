import { redirect } from 'next/navigation';

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?type=property&q=lokasi%20jualan`);
}
