import { NextRequest, NextResponse } from 'next/server';
import { getPublishedBlogArticles } from '@/lib/blog';

function readLocale(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale');
  return locale === 'en' ? 'en' : 'id';
}

export async function GET(request: NextRequest) {
  const locale = readLocale(request);
  const page = await getPublishedBlogArticles(locale);

  return NextResponse.json({
    items: page.items,
    count: page.items.length,
    hasMore: page.hasMore,
    locale,
  });
}
