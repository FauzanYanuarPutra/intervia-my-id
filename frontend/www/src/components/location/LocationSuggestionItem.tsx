'use client';

import {
  Building2,
  House,
  Landmark,
  MapPinned,
  MapPin,
  Route,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LocationSuggestion } from '@/lib/location/location.types';

type LocationSuggestionItemProps = {
  item: LocationSuggestion;
  active?: boolean;
  query?: string;
};

function Highlight({ text, query }: { text: string; query?: string }) {
  const needle = (query || '').trim();
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <strong className="font-extrabold text-slate-950 dark:text-white">
        {text.slice(index, index + needle.length)}
      </strong>
      {text.slice(index + needle.length)}
    </>
  );
}

export function LocationSuggestionItem({
  item,
  active,
  query,
}: LocationSuggestionItemProps) {
  const resultType =
    item.source === 'business' ? 'business' : item.resultType || 'place';
  const resultPresentation = {
    business: { Icon: Building2, label: 'Usaha' },
    address: { Icon: House, label: 'Alamat' },
    road: { Icon: Route, label: 'Jalan' },
    place: { Icon: MapPin, label: 'Tempat' },
    city: { Icon: Landmark, label: 'Kota' },
    area: { Icon: MapPinned, label: 'Area' },
  }[resultType];
  const Icon = resultPresentation.Icon;
  return (
    <div
      className={cn(
        'flex min-h-[56px] items-start gap-3 rounded-[14px] px-3 py-2.5 text-left transition',
        active
          ? 'bg-emerald-50 text-slate-950 dark:bg-emerald-500/12 dark:text-white'
          : 'text-slate-800 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800',
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          item.source === 'business'
            ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/12 dark:text-blue-200'
            : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/12 dark:text-emerald-200',
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block line-clamp-1 text-sm font-bold">
          <Highlight text={item.primaryText} query={query} />
        </span>
        <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {item.secondaryText || item.description}
        </span>
      </span>
      {resultPresentation.label ? (
        <span className="mt-1 shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {resultPresentation.label}
        </span>
      ) : null}
    </div>
  );
}
