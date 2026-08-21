import type {
  OverviewActionCard,
  OverviewIcons,
  OverviewRoutes,
} from '../types';

type EntryCardInput = {
  icons: OverviewIcons;
  isId: boolean;
  routes: OverviewRoutes;
  setupHref: string;
  storeCount: number;
};

export function buildEntryOverviewCards({
  icons,
  isId,
  routes,
  setupHref,
  storeCount,
}: EntryCardInput): OverviewActionCard[] {
  return [
    {
      desc: getEntryCardDescription(storeCount, isId),
      href: setupHref,
      icon: icons.store,
      label: getEntryCardLabel(storeCount, isId),
      primary: true,
    },
    {
      desc: isId
        ? 'Bantu isi cepat.'
        : 'Fill faster.',
      href: routes.assistant(),
      icon: icons.assistant,
      label: isId ? 'Pakai asisten' : 'Use assistant',
    },
    {
      desc: isId
        ? 'Cek usaha sekitar.'
        : 'Check nearby businesses.',
      href: routes.discoveryPath,
      icon: icons.discovery,
      label: isId ? 'Cari usaha sekitar' : 'Browse nearby businesses',
    },
  ];
}

function getEntryCardLabel(storeCount: number, isId: boolean): string {
  if (storeCount > 0) return isId ? 'Pilih usaha' : 'Choose business';
  return isId ? 'Buat usaha' : 'Add business';
}

function getEntryCardDescription(storeCount: number, isId: boolean): string {
  if (storeCount > 0) {
    return isId
      ? 'Pilih usaha yang mau dipakai.'
      : 'Pick the business to use now.';
  }

  return isId ? 'Mulai dari usaha pertama.' : 'Start with the first business.';
}
