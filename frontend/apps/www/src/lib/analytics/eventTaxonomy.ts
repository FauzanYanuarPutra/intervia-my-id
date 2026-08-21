'use client';

export type LajukanRouteViewEvent = {
  eventName: string;
  module: string;
  surface: string;
};

const ROUTE_VIEW_EVENTS: Array<{
  prefix: string;
  eventName: string;
  module: string;
  surface: string;
}> = [
  {
    prefix: '/home',
    eventName: 'home.viewed',
    module: 'home',
    surface: 'home',
  },
  {
    prefix: '/explore',
    eventName: 'explore.viewed',
    module: 'explore',
    surface: 'explore',
  },
  {
    prefix: '/umkm',
    eventName: 'maps.opened',
    module: 'maps',
    surface: 'umkm',
  },
  {
    prefix: '/community',
    eventName: 'community.viewed',
    module: 'community',
    surface: 'community',
  },
  {
    prefix: '/reels',
    eventName: 'reels.viewed',
    module: 'reels',
    surface: 'reels',
  },
  {
    prefix: '/learn',
    eventName: 'learn.viewed',
    module: 'learn',
    surface: 'learn',
  },
  {
    prefix: '/education',
    eventName: 'learn.education_viewed',
    module: 'learn',
    surface: 'education',
  },
  {
    prefix: '/create',
    eventName: 'listing.create_started',
    module: 'listing',
    surface: 'create',
  },
  {
    prefix: '/chat',
    eventName: 'chat.opened',
    module: 'chat',
    surface: 'chat',
  },
  {
    prefix: '/transactions',
    eventName: 'transaction.workspace_viewed',
    module: 'transaction',
    surface: 'transactions',
  },
  {
    prefix: '/payments',
    eventName: 'finance.workspace_viewed',
    module: 'finance',
    surface: 'payments',
  },
  {
    prefix: '/usaha',
    eventName: 'business.workspace_viewed',
    module: 'usaha',
    surface: 'usaha',
  },
  {
    prefix: '/dashboard',
    eventName: 'business_os.dashboard_viewed',
    module: 'business_os',
    surface: 'dashboard',
  },
  {
    prefix: '/my-projects',
    eventName: 'project.workspace_viewed',
    module: 'project',
    surface: 'my_projects',
  },
  {
    prefix: '/my-listings',
    eventName: 'listing.workspace_viewed',
    module: 'listing',
    surface: 'my_listings',
  },
  {
    prefix: '/support',
    eventName: 'support.workspace_viewed',
    module: 'support',
    surface: 'support',
  },
  {
    prefix: '/profile',
    eventName: 'profile.workspace_viewed',
    module: 'profile',
    surface: 'profile',
  },
  {
    prefix: '/settings',
    eventName: 'settings.workspace_viewed',
    module: 'settings',
    surface: 'settings',
  },
  {
    prefix: '/marketplace',
    eventName: 'marketplace.viewed',
    module: 'marketplace',
    surface: 'marketplace',
  },
  {
    prefix: '/jobs',
    eventName: 'talent.jobs_viewed',
    module: 'talent',
    surface: 'jobs',
  },
  {
    prefix: '/freelancers',
    eventName: 'talent.freelancers_viewed',
    module: 'talent',
    surface: 'freelancers',
  },
  {
    prefix: '/property',
    eventName: 'property.viewed',
    module: 'property',
    surface: 'property',
  },
];

export function stripLocaleFromPathname(pathname: string): string {
  const clean = pathname || '/';
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'id' || parts[0] === 'en') {
    return `/${parts.slice(1).join('/')}` || '/';
  }
  return clean.startsWith('/') ? clean : `/${clean}`;
}

export function resolveRouteViewEvent(
  pathname: string,
): LajukanRouteViewEvent | null {
  const path = stripLocaleFromPathname(pathname);
  return (
    ROUTE_VIEW_EVENTS.find(
      item => path === item.prefix || path.startsWith(`${item.prefix}/`),
    ) || null
  );
}
