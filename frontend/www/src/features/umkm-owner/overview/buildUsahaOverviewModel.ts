import type {
  OverviewFlowStep,
  OverviewIcons,
  OverviewModel,
  OverviewRoutes,
  OverviewStore,
} from './types';
import {
  buildEntryOverviewCards,
  buildSelectedOverviewCards,
} from './overviewActionCards';
import {
  formatBusinessCountLabel,
  formatOverviewLocation,
  getOverviewNextAction,
  getOverviewSubtitle,
  getOverviewTitle,
  getPrimaryActionLabel,
  type OverviewStepCopy,
} from './overviewCopy';

type BuildOverviewInput = {
  icons: OverviewIcons;
  isId: boolean;
  nextOwnerStep?: OverviewStepCopy | null;
  routes: OverviewRoutes;
  selectedStore?: OverviewStore | null;
  stores: OverviewStore[];
};

export function buildUsahaOverviewModel({
  icons,
  isId,
  nextOwnerStep,
  routes,
  selectedStore,
  stores,
}: BuildOverviewInput): OverviewModel {
  const storeCount = stores.length;
  const selected = selectedStore || null;
  const setupHref = routes.setup(storeCount > 0 ? 'list' : 'create');
  const mapAction = buildMapAction(routes.discoveryPath, selected, isId);

  return {
    activeBadge: formatBusinessCountLabel(storeCount, isId),
    activeBadgeTone: storeCount > 0 ? 'accent' : 'default',
    actionCards: selected
      ? buildSelectedOverviewCards({ icons, isId, routes, selected })
      : buildEntryOverviewCards({ icons, isId, routes, setupHref, storeCount }),
    addStoreAction: {
      href: routes.setup('create'),
      label: isId ? 'Tambah usaha baru' : 'Add new business',
    },
    flowSteps: buildOverviewFlowSteps({
      isId,
      mapHref: mapAction.href,
      nextOwnerStep,
      routes,
      selected,
      setupHref,
      storeCount,
    }),
    mapAction,
    nextAction: getOverviewNextAction(selected, isId, nextOwnerStep),
    primaryAction: {
      href: selected ? routes.storefront(selected.slug) : setupHref,
      label: getPrimaryActionLabel({
        hasSelectedStore: Boolean(selected),
        isId,
        storeCount,
      }),
    },
    secondaryAction: {
      href: selected ? routes.setup('list', selected.id) : routes.assistant(),
      label: selected
        ? isId
          ? 'Lihat semua usaha'
          : 'See all businesses'
        : isId
          ? 'Pakai asisten'
          : 'Use assistant',
    },
    storeChoices: stores.map(store => ({
      id: store.id,
      name: store.name,
      meta: formatOverviewLocation(store, isId),
      href: routes.workspace('overview', store.id),
      selected: store.id === selected?.id,
    })),
    subtitle: getOverviewSubtitle(storeCount, isId),
    title: getOverviewTitle(storeCount, isId),
  };
}

function appendQueryParam(path: string, key: string, value: string): string {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function buildMapAction(
  discoveryPath: string,
  selected: OverviewStore | null,
  isId: boolean,
): OverviewModel['mapAction'] {
  return {
    badge: selected
      ? selected.city || (isId ? 'Usaha aktif' : 'Active business')
      : isId
        ? 'Full map'
        : 'Full map',
    desc: selected
      ? isId
        ? 'Lihat titik usaha.'
        : 'Open the business pin.'
      : isId
        ? 'Cek usaha sekitar.'
        : 'Check nearby businesses.',
    href: selected
      ? appendQueryParam(discoveryPath, 'storeId', selected.id)
      : discoveryPath,
    label: selected
      ? isId
        ? 'Lihat di Maps'
        : 'View on Maps'
      : isId
        ? 'Buka Maps usaha'
        : 'Open business map',
  };
}

function buildOverviewFlowSteps({
  isId,
  mapHref,
  nextOwnerStep,
  routes,
  selected,
  setupHref,
  storeCount,
}: {
  isId: boolean;
  mapHref: string;
  nextOwnerStep?: OverviewStepCopy | null;
  routes: OverviewRoutes;
  selected: OverviewStore | null;
  setupHref: string;
  storeCount: number;
}): OverviewFlowStep[] {
  if (!selected) {
    return buildEntryFlowSteps({ isId, setupHref, storeCount });
  }

  return buildSelectedFlowSteps({
    isId,
    mapHref,
    nextOwnerStep,
    routes,
    selected,
  });
}

function buildEntryFlowSteps({
  isId,
  setupHref,
  storeCount,
}: {
  isId: boolean;
  setupHref: string;
  storeCount: number;
}): OverviewFlowStep[] {
  return [
    {
      active: true,
      desc:
        storeCount > 0
          ? isId
            ? 'Pilih yang mau dikerjakan.'
            : 'Choose one to work on.'
          : isId
            ? 'Isi profil singkat.'
            : 'Fill a short profile.',
      done: storeCount > 0,
      href: setupHref,
      label:
        storeCount > 0
          ? isId
            ? 'Pilih usaha'
            : 'Choose business'
          : isId
            ? 'Buat usaha'
            : 'Add business',
    },
    {
      active: false,
      desc: isId ? 'Tambah foto dan lokasi.' : 'Add photo and location.',
      done: false,
      href: setupHref,
      label: isId ? 'Foto & lokasi' : 'Photo & location',
    },
    {
      active: false,
      desc: isId ? 'Masukkan jualan pertama.' : 'Add the first item.',
      done: false,
      href: setupHref,
      label: isId ? 'Isi katalog' : 'Fill catalog',
    },
  ];
}

function buildSelectedFlowSteps({
  isId,
  mapHref,
  nextOwnerStep,
  routes,
  selected,
}: {
  isId: boolean;
  mapHref: string;
  nextOwnerStep?: OverviewStepCopy | null;
  routes: OverviewRoutes;
  selected: OverviewStore;
}): OverviewFlowStep[] {
  const profileDone = Boolean(selected.city && selected.address);
  const activeLabel = nextOwnerStep?.label || '';

  return [
    {
      active: false,
      desc: isId ? 'Usaha aktif.' : 'Active business.',
      done: true,
      href: routes.setup('list', selected.id),
      label: isId ? 'Usaha dipilih' : 'Business selected',
    },
    {
      active: activeLabel.toLowerCase().includes('setup'),
      desc: isId ? 'Foto, alamat, kontak.' : 'Photo, address, contact.',
      done: profileDone,
      href: routes.setup('detail', selected.id),
      label: isId ? 'Profil & lokasi' : 'Profile & location',
    },
    {
      active: activeLabel.toLowerCase().includes('katalog'),
      desc: isId ? 'Jualan, foto, harga.' : 'Items, photos, prices.',
      done: false,
      href: routes.workspace('catalog', selected.id),
      label: isId ? 'Katalog' : 'Catalog',
    },
    {
      active: false,
      desc: isId ? 'Cek titik dan share.' : 'Check pin and share.',
      done: profileDone,
      href: mapHref,
      label: isId ? 'Maps & promosi' : 'Maps & promo',
    },
  ];
}
