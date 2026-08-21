'use client';

import dynamic from 'next/dynamic';

export type ContentMapPoint = {
  lat: number;
  lng: number;
};

type ContentLocationMapProps = {
  point: ContentMapPoint;
  title: string;
  address?: string;
  className?: string;
};

const ContentLocationMapClient = dynamic(
  () =>
    import('./ContentLocationMapClient').then(
      module => module.ContentLocationMapClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[220px] w-full items-center justify-center rounded-[18px] bg-emerald-50 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
        Memuat peta lokasi...
      </div>
    ),
  },
);

export function ContentLocationMap(props: ContentLocationMapProps) {
  return <ContentLocationMapClient {...props} />;
}
