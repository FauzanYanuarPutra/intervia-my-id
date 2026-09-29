import { buildPublicPageMetadata } from '@/lib/seo/publicPageMetadata';
import type { Metadata } from 'next';
import MicroGISDashboard from './MicrogigsClient';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return buildPublicPageMetadata({
    locale,
    path: '/microgigs',
    titleId: 'Microgigs — Tugas Cepat untuk Usaha | Lajukan',
    titleEn: 'Microgigs — Quick Business Tasks | Lajukan',
    descriptionId: 'Temukan pekerjaan mikro dan tugas cepat dengan scope yang jelas di Lajukan.',
    descriptionEn: 'Find quick micro tasks and clearly scoped business work on Lajukan.',
  });
}

export default function MicrogigsPage() {
  return <MicroGISDashboard />;
}