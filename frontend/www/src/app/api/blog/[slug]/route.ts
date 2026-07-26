import { NextRequest, NextResponse } from 'next/server';
import { getPublishedBlogArticle } from '@/lib/seo/blogContent';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function readLocale(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale');
  return locale === 'en' ? 'en' : 'id';
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const { slug } = await params;
  const locale = readLocale(request);
  const article = await getPublishedBlogArticle(slug, locale);

  if (!article) {
    return NextResponse.json(
      { error: 'Blog article not found' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    item: article,
    locale,
  });
}
