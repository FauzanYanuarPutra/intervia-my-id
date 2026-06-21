'use client';

import dynamic from 'next/dynamic';
import type { LatLng } from '@/lib/super-app/maps';

type UmkmLocationPickerProps = {
  value: LatLng | null;
  onChange: (point: LatLng) => void;
  className?: string;
  isId?: boolean;
  markerLabel?: string;
};

const UmkmLocationPickerClient = dynamic(
  () =>
    import('./UmkmLocationPickerClient').then(
      (module) => module.UmkmLocationPickerClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[320px] w-full items-center justify-center rounded-[24px] border border-[color:var(--app-accent-border)] bg-white text-xs font-semibold text-[color:var(--app-accent)] sm:h-[420px]">
        Loading map...
      </div>
    ),
  },
);

export function UmkmLocationPicker(props: UmkmLocationPickerProps) {
  return <UmkmLocationPickerClient {...props} />;
}
