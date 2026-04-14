import type { Metadata } from 'next';
import { buildContentHref, extractContentId } from '@/lib/content/routes';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com';

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string; id: string }>;
};

async function getContent(id: string) {
  try {
    const resolvedId = extractContentId(id) || id;
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${base}/api/content/${resolvedId}`, {
      next: { revalidate: 60 },
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const content = await getContent(id);
  if (!content?.title) {
    return {
      title: 'Content',
      description: 'View content on Lajukan',
    };
  }
  const title = content.title as string;
  const description =
    (content.summary as string)?.slice(0, 160) ||
    `View ${content.type || 'content'}: ${title}`;
  const canonicalPath = buildContentHref(content.id || id, title, content.slug);
  const canonical = `${SITE_URL}/${locale}${canonicalPath}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${title} | Lajukan`,
      description,
      url: canonical,
      siteName: 'Lajukan',
      type: 'article',
      locale: locale === 'id' ? 'id_ID' : 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | Lajukan`,
      description,
    },
    robots: { index: true, follow: true },
  };
}

export default function ContentIdLayout({ children }: Props) {
  return <>{children}</>;
}
