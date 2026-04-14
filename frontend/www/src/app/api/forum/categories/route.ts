import { NextResponse } from 'next/server';
import { getForumStore } from '@/lib/forum/store';
import { syncForumDerivedState } from '@/lib/forum/queries';

export async function GET() {
  const store = getForumStore();
  syncForumDerivedState(store);
  const categories = [...store.categories].sort((a, b) => a.order - b.order);
  return NextResponse.json({ data: categories });
}

