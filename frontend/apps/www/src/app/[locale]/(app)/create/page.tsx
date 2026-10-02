import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CreateListingWizard from './CreateListingWizard';
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

  return (
    <CreateListingWizard
      categoryId={category?.id}
    />
  );
}
