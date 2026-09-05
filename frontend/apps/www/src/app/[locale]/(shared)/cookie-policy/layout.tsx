import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';

import { buildStaticPublicPageMetadata } from '@/lib/seo/publicStaticPageMetadata';

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  return buildStaticPublicPageMetadata('cookie-policy', locale);
}

export default async function CookiePolicyLayout({ children, params }: Props) {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  return children;
}
