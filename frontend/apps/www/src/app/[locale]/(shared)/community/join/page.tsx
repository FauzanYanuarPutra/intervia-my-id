import type { Metadata } from 'next';
import CommunityJoinClient from './CommunityJoinClient';

export const metadata: Metadata = {
  title: 'Gabung Komunitas Rantai Usaha Lokal | Lajukan',
  description: 'Masuk ke Komunitas Rantai Usaha Lokal setelah login dan mencantumkan minimal satu listing usaha.',
};

export default async function CommunityJoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <CommunityJoinClient isId={locale === 'id'} />;
}
