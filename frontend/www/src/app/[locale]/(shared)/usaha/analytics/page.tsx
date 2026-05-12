import { redirect } from 'next/navigation';
import { buildUsahaPortalHref } from '@/lib/umkmSurface';

export default async function UsahaAnalyticsPage() {
  redirect(buildUsahaPortalHref('analytics'));
}
