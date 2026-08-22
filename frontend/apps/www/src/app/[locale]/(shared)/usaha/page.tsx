import { redirect } from 'next/navigation';
import { getUsahaWorkspaceUrl } from '@/lib/usahaWorkspace';

export default async function UsahaPage() {
  redirect(getUsahaWorkspaceUrl('/'));
}
