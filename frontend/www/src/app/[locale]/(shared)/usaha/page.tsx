import { redirect } from 'next/navigation';
import {
  readSurfaceStoreId,
  type SurfaceSearchParams,
} from '@/lib/umkmSurface';
import { resolveUsahaOwnerGatewayTarget } from '@/lib/server/usahaOwnerGateway';

type PageProps = {
  searchParams: Promise<SurfaceSearchParams>;
};

export default async function UsahaPage({ searchParams }: PageProps) {
  const storeId = readSurfaceStoreId(await searchParams);
  const target = await resolveUsahaOwnerGatewayTarget({
    preferredStoreId: storeId,
  });
  redirect(target.href);
}
