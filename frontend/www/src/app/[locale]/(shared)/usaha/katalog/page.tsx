import { redirect } from 'next/navigation';
import { buildUsahaPortalHref } from '@/lib/umkmSurface';

export default async function UsahaCatalogPage() {
  redirect(buildUsahaPortalHref('catalog'));
}
