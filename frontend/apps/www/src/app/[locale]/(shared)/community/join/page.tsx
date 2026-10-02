import type { Metadata } from 'next';
import CommunityJoinClient from './CommunityJoinClient';

export const metadata: Metadata = {
  title: 'Gabung Komunitas Rantai Usaha Lokal | Lajukan',
  description: 'Gabung Komunitas Rantai Usaha Lokal di WhatsApp dan pilih grup yang paling relevan dengan kebutuhan usaha.',
};

export default async function CommunityJoinPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <CommunityJoinClient isId={locale === 'id'} />;
}
