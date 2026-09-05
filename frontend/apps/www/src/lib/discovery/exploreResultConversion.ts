import type {
  GlobalSearchGroupKey,
  GlobalSearchTab,
} from '@/lib/search/globalSearch';
import type { LajukanLocale } from '@/lib/discovery/lajukanCategories';

type ResultAction = {
  label: string;
  analyticsAction: string;
};

type RecoveryAction = ResultAction & {
  href: string;
};

const RESULT_ACTIONS: Partial<
  Record<GlobalSearchGroupKey, Record<LajukanLocale, ResultAction>>
> = {
  products: {
    id: { label: 'Lihat detail', analyticsAction: 'open_listing_detail' },
    en: { label: 'View details', analyticsAction: 'open_listing_detail' },
  },
  services: {
    id: { label: 'Lihat detail', analyticsAction: 'open_listing_detail' },
    en: { label: 'View details', analyticsAction: 'open_listing_detail' },
  },
  businesses: {
    id: { label: 'Lihat profil', analyticsAction: 'open_business_profile' },
    en: { label: 'View profile', analyticsAction: 'open_business_profile' },
  },
  needs: {
    id: { label: 'Lihat kebutuhan', analyticsAction: 'open_need_detail' },
    en: { label: 'View need', analyticsAction: 'open_need_detail' },
  },
  users: {
    id: { label: 'Lihat profil', analyticsAction: 'open_user_profile' },
    en: { label: 'View profile', analyticsAction: 'open_user_profile' },
  },
};

export function getExploreResultAction(
  kind: GlobalSearchGroupKey,
  locale: LajukanLocale,
): ResultAction {
  return (
    RESULT_ACTIONS[kind]?.[locale] || {
      label: locale === 'id' ? 'Lihat detail' : 'View details',
      analyticsAction: 'open_result_detail',
    }
  );
}

export function getZeroResultRecovery({
  locale,
  searchSide,
  activeTab,
}: {
  locale: LajukanLocale;
  searchSide: 'supply' | 'demand';
  activeTab: GlobalSearchTab;
}): RecoveryAction[] {
  const isId = locale === 'id';

  if (activeTab === 'references') {
    return [
      {
        label: isId ? 'Kembali ke Jelajahi' : 'Back to Explore',
        href: '/explore',
        analyticsAction: 'browse_explore',
      },
    ];
  }

  return [
    {
      label: isId ? 'Jelajahi kategori' : 'Browse categories',
      href: '/explore',
      analyticsAction: 'browse_explore',
    },
    searchSide === 'demand'
      ? {
          label: isId ? 'Tawarkan yang kamu punya' : 'Post what you offer',
          href: '/create?side=supply',
          analyticsAction: 'post_offer',
        }
      : {
          label: isId ? 'Pasang kebutuhan' : 'Post a need',
          href: '/create?side=demand',
          analyticsAction: 'post_need',
        },
  ];
}
