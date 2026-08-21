import { NextRequest, NextResponse } from 'next/server';
import { getPublishedBlogArticles } from '@/lib/seo/blogContent';

function readLocale(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale');
  return locale === 'en' ? 'en' : 'id';
}

export async function GET(request: NextRequest) {
  const locale = readLocale(request);
  const articles = await getPublishedBlogArticles(locale);

  return NextResponse.json({
    items: articles,
    count: articles.length,
    locale,
  });
}
