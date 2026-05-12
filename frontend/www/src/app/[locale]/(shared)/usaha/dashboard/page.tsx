import { redirect } from 'next/navigation';
import { buildUsahaPortalHref } from '@/lib/umkmSurface';

export default async function UsahaDashboardPage() {
  redirect(buildUsahaPortalHref('dashboard'));
}
