import { NextRequest, NextResponse } from 'next/server';
import { getForumStore } from '@/lib/forum/store';
import { syncForumDerivedState } from '@/lib/forum/queries';

export async function GET(req: NextRequest) {
  const store = getForumStore();
  syncForumDerivedState(store);

  const url = new URL(req.url);
  const popular = url.searchParams.get('popular') === '1';

  const tags = [...store.tags].sort((a, b) =>
    popular ? b.usageCount - a.usageCount : a.name.localeCompare(b.name),
  );

  return NextResponse.json({ data: tags });
}

