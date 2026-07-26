import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import CreateListingWizard from './CreateListingWizard';
import { normalizeCreateBusinessCategorySegment } from './createBusinessData';
import type { CreateFlowIntent } from './createPageUtils';

export const metadata: Metadata = {
  title: 'Create Posting | Lajukan',
  description:
    'Buat kebutuhan atau penawaran usaha dari brief singkat. Detail tambahan, foto, dokumen, dan lokasi bisa dilengkapi seperlunya.',
};

type CreateSearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0]?.trim() || '';
  return typeof value === 'string' ? value.trim() : '';
}

function intentFromSearchParams(
  searchParams: CreateSearchParams,
): CreateFlowIntent | undefined {
  const side = firstParam(searchParams.side);
  if (side === 'demand' || side === 'supply') return side;

  const mode = firstParam(searchParams.mode).toLowerCase();
  if (mode === 'find' || mode === 'need' || mode === 'request') {
    return 'demand';
  }
  if (mode === 'offer' || mode === 'sell' || mode === 'quick') {
    return 'supply';
  }
  return undefined;
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
      entryMode={intentFromSearchParams(resolvedSearchParams)}
      categoryId={category?.id}
    />
  );
}
