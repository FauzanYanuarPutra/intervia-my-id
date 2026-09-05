import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { buildStaticPublicPageMetadata } from '@/lib/seo/publicStaticPageMetadata';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return buildStaticPublicPageMetadata('support', locale);
}

export default function SupportLayout({ children }: Props) {
  return children;
}
