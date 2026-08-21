import type { Metadata } from 'next';
import type { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Pick<LayoutProps, 'params'>): Promise<Metadata> {
  const { locale } = await params;

  return {
    robots: { index: false, follow: true },
    alternates: {
      canonical: `https://www.lajukan.com/${locale}/home`,
    },
  };
}

export default function SuperAppLayout({ children }: Pick<LayoutProps, 'children'>) {
  return children;
}
