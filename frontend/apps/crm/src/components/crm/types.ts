export type PageId =
  | 'dashboard'
  | 'pipeline'
  | 'users'
  | 'listings'
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
  | 'users';

export type CrmNavItem = {
  id: PageId;
  label: string;
  hint: string;
  icon: IconName;
};
