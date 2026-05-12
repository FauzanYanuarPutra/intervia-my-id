'use client';

import dynamic from 'next/dynamic';
import type { BusinessLocationMapProps } from '@/components/maps/BusinessLocationMapClient';

const BusinessLocationMapLeaflet = dynamic<BusinessLocationMapProps>(
  () =>
    import('@/components/maps/BusinessLocationMapClient').then(
      module => module.BusinessLocationMapClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="overflow-hidden rounded-[24px] border border-portal-line/70 bg-white">
        <div className="h-[240px] w-full animate-pulse bg-[linear-gradient(135deg,rgba(29,106,67,0.08),rgba(200,141,47,0.08))] sm:h-[320px]" />
      </div>
    ),
  },
);

export type { BusinessLocationMapProps } from '@/components/maps/BusinessLocationMapClient';

export function BusinessLocationMap(props: BusinessLocationMapProps) {
  return <BusinessLocationMapLeaflet {...props} />;
}
