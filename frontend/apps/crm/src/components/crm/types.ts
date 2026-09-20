export type PageId =
  | 'dashboard'
  | 'pipeline'
  | 'users'
  | 'businesses'
  | 'listings'
  | 'news'
  | 'transactions'
  | 'chat'
  | 'analytics'
  | 'disputes'
  | 'settings';

export type IconName =
  | 'analytics'
  | 'bell'
  | 'chat'
  | 'chevron'
  | 'dashboard'
  | 'disputes'
  | 'listings'
  | 'logout'
  | 'menu'
  | 'pipeline'
  | 'search'
  | 'settings'
  | 'transactions'
  | 'users'
  | 'businesses'
  | 'news';

export type CrmNavItem = {
  id: PageId;
  label: string;
  hint: string;
  icon: IconName;
};
