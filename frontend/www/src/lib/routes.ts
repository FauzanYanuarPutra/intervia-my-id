// src/lib/routes.ts

export enum Role {
  GUEST = 'GUEST',
  USER = 'USER',
  ADMIN = 'ADMIN',
  BUYER = 'BUYER',
}

export enum RoutePath {
  HOME = '/home',
  SEARCH = '/search',
  MARKETPLACE = '/marketplace',
  JOBS = '/jobs',
  FREELANCERS = '/freelancers',
  MICROGIGS = '/microgigs',
  PROPERTY = '/property',
  SUPPORT = '/support',
  PAYMENTS = '/payments',
  SUPER_APP = '/super-app',

  CHAT = '/chat',
  TRANSACTIONS = '/transactions',
  NOTIFICATIONS = '/notifications',
  CREATE = '/create',
  PROFILE = '/profile',
  DASHBOARD = '/dashboard',
  SETTINGS = '/settings',
  MY_LISTINGS = '/my-listings',
  MY_APPLICATIONS = '/my-applications',
  MY_PROJECTS = '/my-projects',

  LOGIN = '/login',
  REGISTER = '/register',
  FORGOT_PASSWORD = '/forgot-password',
  RESET_PASSWORD = '/reset-password',
}

export interface MetaType {
  navbar: { isVisibleOnWeb: boolean; isVisibleOnMobile: boolean };
  bottomNav: { isVisibleOnWeb: boolean; isVisibleOnMobile: boolean };
  footer: { isVisibleOnWeb: boolean; isVisibleOnMobile: boolean };
}

export interface RouteConfig {
  path: string;
  name: string;
  meta: MetaType;
  children?: RouteConfig[];
  access: Role[];
  shared?: boolean;
  guestOnly?: boolean;
}

const PUBLIC_ACCESS: Role[] = [Role.GUEST, Role.USER, Role.ADMIN, Role.BUYER];
const AUTH_ACCESS: Role[] = [Role.USER, Role.ADMIN, Role.BUYER];

const DEFAULT_META: MetaType = {
  navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
  bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
  footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
};

const CATEGORY_META: MetaType = {
  navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
  bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
  footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
};

const APP_META: MetaType = {
  navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
  bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
  footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
};

const HIDDEN_META: MetaType = {
  navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
  bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
  footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
};

const CHAT_FOCUS_META: MetaType = {
  navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
  bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
  footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
};

export const routes: RouteConfig[] = [
  {
    path: RoutePath.HOME,
    name: 'Home',
    meta: HIDDEN_META,
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.SEARCH,
    name: 'Search',
    meta: HIDDEN_META,
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: '/kategori',
    name: 'Categories',
    meta: CATEGORY_META,
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.MARKETPLACE,
    name: 'Marketplace',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.JOBS,
    name: 'Jobs',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: `${RoutePath.JOBS}/create`,
        name: 'Create Job',
        meta: APP_META,
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.JOBS}/:slug`,
        name: 'Job Detail',
        meta: DEFAULT_META,
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.FREELANCERS,
    name: 'Freelancers',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: `${RoutePath.FREELANCERS}/:slug`,
        name: 'Freelancer Detail',
        meta: DEFAULT_META,
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.MICROGIGS,
    name: 'Microgigs',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.PROPERTY,
    name: 'Property',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: `${RoutePath.PROPERTY}/create`,
        name: 'Create Property',
        meta: APP_META,
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.PROPERTY}/:slug`,
        name: 'Property Detail',
        meta: DEFAULT_META,
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.SUPPORT,
    name: 'Support',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.PAYMENTS,
    name: 'Payments',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.SUPER_APP,
    name: 'Super App',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: `${RoutePath.SUPER_APP}/:service`,
        name: 'Super App Service',
        meta: DEFAULT_META,
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: '/content/:id',
    name: 'Content Detail',
    meta: DEFAULT_META,
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: '/content/:id/edit',
        name: 'Edit Content',
        meta: APP_META,
        access: AUTH_ACCESS,
      },
    ],
  },

  // Protected routes
  {
    path: RoutePath.DASHBOARD,
    name: 'Dashboard',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.CREATE,
    name: 'Create Posting',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.PROFILE,
    name: 'Profile',
    meta: APP_META,
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.PROFILE}/edit`,
        name: 'Edit Profile',
        meta: APP_META,
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.PROFILE}/freelancer/create`,
        name: 'Create Freelancer Profile',
        meta: APP_META,
        access: AUTH_ACCESS,
      },
    ],
  },
  {
    path: RoutePath.SETTINGS,
    name: 'Settings',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.TRANSACTIONS,
    name: 'Activity',
    meta: APP_META,
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.TRANSACTIONS}/:id`,
        name: 'Transaction Detail',
        meta: APP_META,
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.TRANSACTIONS}/:id/review`,
        name: 'Transaction Review',
        meta: APP_META,
        access: AUTH_ACCESS,
      },
    ],
  },
  {
    path: RoutePath.NOTIFICATIONS,
    name: 'Notifications',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.MY_LISTINGS,
    name: 'My Listings',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.MY_APPLICATIONS,
    name: 'My Applications',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.MY_PROJECTS,
    name: 'My Projects',
    meta: APP_META,
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.CHAT,
    name: 'Messages',
    meta: CHAT_FOCUS_META,
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.CHAT}/:id`,
        name: 'Chat Detail',
        meta: CHAT_FOCUS_META,
        access: AUTH_ACCESS,
      },
    ],
  },

  // Auth routes (guest only)
  {
    path: RoutePath.LOGIN,
    name: 'Login',
    meta: HIDDEN_META,
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
  {
    path: RoutePath.REGISTER,
    name: 'Register',
    meta: HIDDEN_META,
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
  {
    path: RoutePath.FORGOT_PASSWORD,
    name: 'Forgot Password',
    meta: HIDDEN_META,
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
  {
    path: RoutePath.RESET_PASSWORD,
    name: 'Reset Password',
    meta: HIDDEN_META,
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
];
