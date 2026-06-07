import {
  LearningHubClient,
  type LearningCourse,
} from '@/components/learn/LearningHubClient';
import type { Metadata } from 'next';

type PageProps = {
  params: Promise<{ locale: string }>;
};

type LearningCoursesResponse = {
  items?: LearningCourse[];
};

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';
const LEARNING_FETCH_TIMEOUT_MS = 2500;
const SITE_URL = 'https://www.lajukan.com';

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const isId = locale === 'id';

  return {
    title: isId
      ? 'Belajar Bisnis UMKM dari Creator | Lajukan Learn'
      : 'Creator-Led Business Learning | Lajukan Learn',
    description: isId
      ? 'Kelas, video, dan bacaan bisnis dari creator Lajukan untuk supplier, reseller, jasa, operasional, dan UMKM.'
      : 'Courses, videos, and business reading from Lajukan creators for suppliers, resellers, services, operations, and small businesses.',
    alternates: {
      canonical: `${SITE_URL}/${locale}/learn`,
      languages: {
        id: `${SITE_URL}/id/learn`,
        en: `${SITE_URL}/en/learn`,
        'x-default': `${SITE_URL}/id/learn`,
      },
    },
    robots: { index: true, follow: true },
    openGraph: {
      title: isId
        ? 'Belajar Bisnis UMKM dari Creator'
        : 'Creator-Led Business Learning',
      description: isId
        ? 'Temukan kelas, video, dan bacaan praktis untuk mengembangkan usaha.'
        : 'Discover practical courses, videos, and reading for growing a business.',
      url: `${SITE_URL}/${locale}/learn`,
      siteName: 'Lajukan',
      type: 'website',
    },
  };
}

async function getLearningCourses(): Promise<LearningCourse[]> {
  try {
    const response = await fetch(
      `${MARKETPLACE_URL}/v1/learning/courses?limit=48`,
      {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(LEARNING_FETCH_TIMEOUT_MS),
      },
    );
    if (!response.ok) return [];
    const payload = (await response.json()) as LearningCoursesResponse;
    return Array.isArray(payload.items) ? payload.items : [];
  } catch {
    return [];
  }
}

export default async function LearnPage({ params }: PageProps) {
  const { locale } = await params;
  const courses = await getLearningCourses();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name:
      locale === 'id'
        ? 'Materi belajar bisnis Lajukan'
        : 'Lajukan business learning materials',
    itemListElement: courses.slice(0, 24).map((course, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${SITE_URL}/${locale}/learn/${course.slug}`,
      name: course.title,
      description: course.summary || course.description || undefined,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LearningHubClient locale={locale} initialCourses={courses} />
    </>
  );
}
