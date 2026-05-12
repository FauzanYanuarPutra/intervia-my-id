import { redirect } from 'next/navigation';
import {
  buildUsahaPortalHref,
  readSurfaceStoreId,
  type SurfaceSearchParams,
} from '@/lib/umkmSurface';

type PageProps = {
  searchParams: Promise<SurfaceSearchParams>;
};

export default async function UsahaAssistantPage({
  searchParams,
}: PageProps) {
  const storeId = readSurfaceStoreId(await searchParams);
  redirect(buildUsahaPortalHref('assistant', { storeId }));
}
