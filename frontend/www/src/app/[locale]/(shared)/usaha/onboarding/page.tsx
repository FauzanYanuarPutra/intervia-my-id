import { redirect } from 'next/navigation';
import {
  buildUsahaPortalHref,
  readSurfaceSearchParam,
  readSurfaceStoreId,
  type SurfaceSearchParams,
} from '@/lib/umkmSurface';

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SurfaceSearchParams>;
};

export default async function UsahaOnboardingPage({
  searchParams,
}: PageProps) {
  const resolvedSearchParams = await searchParams;
  const storeId = readSurfaceStoreId(resolvedSearchParams);
  const useAssistantRoute =
    readSurfaceSearchParam(resolvedSearchParams, 'assistant') === '1';
  redirect(
    buildUsahaPortalHref(useAssistantRoute ? 'assistant' : 'onboarding', {
      storeId,
    }),
  );
}
