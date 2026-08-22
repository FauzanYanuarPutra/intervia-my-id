import { NextResponse } from 'next/server';
import { getAuthenticatedActor, listWorkspaceOrganizations } from '@/lib/business-server';

export async function GET() {
  const account = await getAuthenticatedActor();
  if (!account) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const organizations = await listWorkspaceOrganizations();
  return NextResponse.json({ account, organizations });
}
