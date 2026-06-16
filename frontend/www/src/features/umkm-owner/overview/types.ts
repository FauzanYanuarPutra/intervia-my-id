import type { ComponentType } from 'react';
import type { UmkmManageWorkspaceId } from '@/lib/super-app/umkm-manage-profiles';

export type OverviewBadgeTone = 'default' | 'accent' | 'warning' | 'success';
export type OverviewIcon = ComponentType<{ className?: string }>;

export type OverviewAction = {
  href: string;
  label: string;
};

export type OverviewActionCard = OverviewAction & {
  desc: string;
  icon: OverviewIcon;
  primary?: boolean;
};

export type OverviewFlowStep = OverviewAction & {
  desc: string;
  done: boolean;
  active: boolean;
};

export type OverviewStore = {
  id: string;
  name: string;
  slug: string;
  city?: string | null;
  address?: string | null;
};

export type OverviewStoreChoice = {
  id: string;
  name: string;
  meta: string;
  href: string;
  selected: boolean;
};

export type OverviewNextAction = {
  title: string;
  desc: string;
  badge: string;
};

export type OverviewRoutes = {
  assistant: () => string;
  discoveryPath: string;
  setup: (
    view: 'list' | 'create' | 'detail',
    storeIdOverride?: string,
  ) => string;
  storefront: (slug: string) => string;
  workspace: (
    workspace: UmkmManageWorkspaceId,
    storeIdOverride?: string,
  ) => string;
};

export type OverviewIcons = {
  addBusiness: OverviewIcon;
  assistant: OverviewIcon;
  catalog: OverviewIcon;
  discovery: OverviewIcon;
  operations: OverviewIcon;
  profile: OverviewIcon;
  store: OverviewIcon;
  switchBusiness: OverviewIcon;
};

export type OverviewModel = {
  activeBadge: string;
  activeBadgeTone: OverviewBadgeTone;
  actionCards: OverviewActionCard[];
  addStoreAction: OverviewAction;
  flowSteps: OverviewFlowStep[];
  mapAction: OverviewAction & {
    badge: string;
    desc: string;
  };
  nextAction?: OverviewNextAction;
  primaryAction: OverviewAction;
  secondaryAction: OverviewAction;
  storeChoices: OverviewStoreChoice[];
  subtitle: string;
  title: string;
};
