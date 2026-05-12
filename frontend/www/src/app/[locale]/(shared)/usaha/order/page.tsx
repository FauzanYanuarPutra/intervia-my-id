import { redirect } from 'next/navigation';
import { buildUsahaPortalHref } from '@/lib/umkmSurface';

export default async function UsahaOrderPage() {
  redirect(buildUsahaPortalHref('order'));
}
