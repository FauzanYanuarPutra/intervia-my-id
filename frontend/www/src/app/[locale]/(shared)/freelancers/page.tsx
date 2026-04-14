import { redirect } from 'next/navigation';

export default async function FreelancerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/search?type=talent&q=umkm`);
}
