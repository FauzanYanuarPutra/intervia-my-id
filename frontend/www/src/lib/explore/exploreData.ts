import type {
  ExploreSectionConfig,
  LajukanExploreCategory,
  LajukanSubcategory,
} from '@/lib/discovery/lajukanCategories';
import type {
  GlobalSearchGroup,
  GlobalSearchResponse,
} from '@/lib/search/globalSearch';

export type ExploreGuide = {
  titleId: string;
  titleEn: string;
  summaryId: string;
  summaryEn: string;
  href: string;
};

export type ExploreFaq = {
  questionId: string;
  questionEn: string;
  answerId: string;
  answerEn: string;
};

export type ExploreCategoryResponse = {
  category: LajukanExploreCategory;
  subcategories: LajukanSubcategory[];
  sections: ExploreSectionConfig[];
  groups: GlobalSearchResponse['groups'];
  guides: ExploreGuide[];
  faq: ExploreFaq[];
  degraded: boolean;
};

export function unavailableExploreGroup(): GlobalSearchGroup {
  return {
    items: [],
    total: 0,
    nextCursor: null,
    available: false,
    error: 'section_unavailable',
  };
}
