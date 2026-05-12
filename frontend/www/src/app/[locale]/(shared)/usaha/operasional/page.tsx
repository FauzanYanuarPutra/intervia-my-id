import { redirect } from 'next/navigation';
import { buildUsahaPortalHref } from '@/lib/umkmSurface';

export default async function UsahaOperationsPage() {
  redirect(buildUsahaPortalHref('operations'));
}
