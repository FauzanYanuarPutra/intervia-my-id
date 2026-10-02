'use client';

import {
  useEmblaWheelGestures,
  type UseEmblaWheelGesturesOptions,
} from '@/components/common/useEmblaWheelGestures';
import type {
  EmblaCarouselType,
  EmblaOptionsType,
  EmblaPluginType,
} from 'embla-carousel';
import useEmblaCarousel from 'embla-carousel-react';

export type LajukanEmblaOptions = EmblaOptionsType & {
  wheel?: UseEmblaWheelGesturesOptions;
};

export type LajukanEmblaResult = [
  ReturnType<typeof useEmblaCarousel>[0],
  EmblaCarouselType | undefined,
];

export function useLajukanEmbla(
  options: LajukanEmblaOptions = {},
  plugins: EmblaPluginType[] = [],
): LajukanEmblaResult {
  const { wheel, ...emblaOptions } = options;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    {
      align: 'start',
      containScroll: 'trimSnaps',
      dragFree: true,
      loop: false,
      skipSnaps: false,
      ...emblaOptions,
    },
    plugins,
  );

  useEmblaWheelGestures(emblaApi, wheel);

  return [emblaRef, emblaApi];
}
