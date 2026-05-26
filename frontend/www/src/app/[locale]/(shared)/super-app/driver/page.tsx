import { redirect } from 'next/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function LegacySuperAppDriverPage({ params }: PageProps) {
  const { locale } = await params;
  redirect(`/${locale}/search?type=service&q=kurir%20pickup%20usaha`);
}
