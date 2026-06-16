import type {
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
