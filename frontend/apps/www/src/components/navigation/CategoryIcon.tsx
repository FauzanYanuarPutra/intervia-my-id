import {
  BriefcaseBusiness,
  Clapperboard,
  Handshake,
  PackageSearch,
  Store,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type { ExploreIconKey } from '@/lib/discovery/lajukanCategories';

const ICONS: Record<ExploreIconKey, LucideIcon> = {
  'package-search': PackageSearch,
  'briefcase-business': BriefcaseBusiness,
  wrench: Wrench,
  store: Store,
  handshake: Handshake,
  users: Users,
  clapperboard: Clapperboard,
};

export function getCategoryIcon(name: ExploreIconKey): LucideIcon {
  return ICONS[name];
}

export function CategoryIcon({
  name,
  className,
}: {
  name: ExploreIconKey;
  className?: string;
}) {
  const Icon = ICONS[name];
  return <Icon className={className} aria-hidden="true" />;
}
