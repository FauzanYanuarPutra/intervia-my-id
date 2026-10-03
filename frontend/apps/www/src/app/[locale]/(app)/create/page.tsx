import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import CreateListingWizard from './CreateListingWizard';
import {
  buildCreateBasePath,
} from './createPageUtils';
import { normalizeCreateBusinessCategorySegment } from './createBusinessData';

export const metadata: Metadata = {
  title: 'Create Listing | Lajukan',
  description:
    'Buat kebutuhan atau penawaran usaha dari brief singkat. Detail tambahan, foto, dokumen, dan lokasi bisa dilengkapi seperlunya.',
};

type CreateSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
}


export default async function CreatePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<CreateSearchParams>;
}) {
  const { locale } = await params;
  if (locale !== 'id' && locale !== 'en') notFound();
  const resolvedSearchParams = await searchParams;

  const category = normalizeCreateBusinessCategorySegment(
    firstParam(resolvedSearchParams.category),
  );
  const side = firstParam(resolvedSearchParams.side);
  const draftId = firstParam(resolvedSearchParams.draft);

  // A side-aware CTA (Home, discovery, category surfaces, etc.) should
  // skip the generic purpose choice and land directly on its category picker.
  // The navbar/header intentionally links to plain /create, so that route
  // keeps the generic two-choice entry screen.
  if (!draftId && (side === 'supply' || side === 'demand')) {
    redirect(
      `/${locale}${buildCreateBasePath({
        locale,
        sideId: side,
        typeId: category?.id,
      })}`,
    );
  }

  return (
    <CreateListingWizard
      categoryId={category?.id}
    />
  );
}
