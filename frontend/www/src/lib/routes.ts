// src/lib/routes.ts
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

export enum Role {
  GUEST = 'GUEST',
  USER = 'USER',
  ADMIN = 'ADMIN',
  BUYER = 'BUYER',
  MERCHANT = 'MERCHANT', // Ditambahkan berdasarkan modul /usaha Anda
}

export enum RoutePath {
  HOME = '/home',
  ABOUT = '/about',
  BLOG = '/blog',
  CHAT = '/chat',
  COMMUNITY = '/community',
  CONTACT = '/contact',
  CONTENT = '/content',
  COOKIE_POLICY = '/cookie-policy',
  CREATE = '/create',
  CRM = '/crm',
  DASHBOARD = '/dashboard',
  EDUCATION = '/education',
  FORGOT_PASSWORD = '/forgot-password',
  JOBS = '/jobs',
  KATEGORI = '/kategori',
  LAINNYA = '/lainnya',
  LEARN = '/learn',
  LOGIN = '/login',
  MICROGIGS = '/microgigs',
  MY_LISTINGS = '/my-listings',
  MY_PROJECTS = '/my-projects',
  NOTIFICATIONS = '/notifications',
  ONBOARDING = '/onboarding',
  PAYMENTS = '/payments',
  PRIVACY = '/privacy',
  PROFILE = '/profile',
  PROPERTY = '/property',
  REFUND_POLICY = '/refund-policy',
  REELS = '/reels',
  REGISTER = '/register',
  RESET_PASSWORD = '/reset-password',
  SEARCH = '/search',
  SETTINGS = '/settings',
  SUPPORT = '/support',
  TERMS = '/terms',
  TOKO = '/toko',
  TRANSACTIONS = '/transactions',
  TRUST = '/trust',
  UMKM = '/umkm',
  USAHA = '/usaha',
}

export interface MetaType {
  topbar?: {
    isVisibleOnWeb: boolean;
    isVisibleOnMobile: boolean;
  };
  navbar: {
    isVisibleOnWeb: boolean;
    isVisibleOnMobile: boolean;
  };
  bottomNav: {
    isVisibleOnWeb: boolean;
    isVisibleOnMobile: boolean;
  };
  footer: {
    isVisibleOnWeb: boolean;
    isVisibleOnMobile: boolean;
  };
  immersive?: boolean;
  routeIntent?: string;
  isDisabled?: boolean;
}

export interface RouteConfig {
  path: string;
  name: string;
  meta: MetaType;
  children?: RouteConfig[];
  access: Role[];
  shared?: boolean;
  guestOnly?: boolean;
  isDisabled?: boolean; // 💡 Flag global untuk menendang page ke home
}

const PUBLIC_ACCESS: Role[] = [Role.GUEST, Role.USER, Role.ADMIN, Role.BUYER];
const AUTH_ACCESS: Role[] = [Role.USER, Role.ADMIN, Role.BUYER];

export const routes: RouteConfig[] = [
  {
    path: RoutePath.HOME,
    name: 'Home',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.SEARCH,
    name: 'Search',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.KATEGORI,
    name: 'Categories',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.JOBS,
    name: 'Jobs',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: PUBLIC_ACCESS,
    shared: true,
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
    children: [
      {
        path: `${RoutePath.JOBS}/:slug`,
        name: 'Job Detail',
        meta: {
          topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
        },
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.MICROGIGS,
    name: 'Microgigs',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.PROPERTY,
    name: 'Property',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: PUBLIC_ACCESS,
    shared: true,
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
    children: [
      {
        path: `${RoutePath.PROPERTY}/:slug`,
        name: 'Property Detail',
        meta: {
          topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
        },
        isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.SUPPORT,
    name: 'Support',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.PAYMENTS,
    name: 'Payments',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    isDisabled: PROMO_ONLY_MODE,
  },
  {
    path: `${RoutePath.CONTENT}/:id`,
    name: 'Content Detail',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: `${RoutePath.CONTENT}/:id/edit`,
        name: 'Edit Content',
        meta: {
          topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
    ],
  },

  // Protected routes
  {
    path: RoutePath.DASHBOARD,
    name: 'Dashboard',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.CREATE,
    name: 'Create Posting',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.CREATE}/:flow`,
        name: 'Create Flow',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.CREATE}/:flow/:listing`,
        name: 'Create Listing Detail',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
    ],
  },
  {
    path: RoutePath.PROFILE,
    name: 'Profile',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.PROFILE}/edit`,
        name: 'Edit Profile',
        meta: {
          topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.PROFILE}/:slug`,
        name: 'Public Profile',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
        },
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.SETTINGS,
    name: 'Settings',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.TRANSACTIONS,
    name: 'Activity',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    isDisabled: PROMO_ONLY_MODE,
    children: [
      {
        path: `${RoutePath.TRANSACTIONS}/:id`,
        name: 'Transaction Detail',
        meta: {
          topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
        isDisabled: PROMO_ONLY_MODE,
      },
      {
        path: `${RoutePath.TRANSACTIONS}/:id/review`,
        name: 'Transaction Review',
        meta: {
          topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
        isDisabled: PROMO_ONLY_MODE,
      },
    ],
  },
  {
    path: RoutePath.NOTIFICATIONS,
    name: 'Notifications',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.MY_LISTINGS,
    name: 'My Listings',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.MY_PROJECTS,
    name: 'My Projects',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    isDisabled: PROMO_ONLY_MODE,
  },
  {
    path: RoutePath.REELS,
    name: 'Reels',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.REELS}/:id`,
        name: 'Reels Detail',
        meta: {
          topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
    ],
  },
  {
    path: RoutePath.CHAT,
    name: 'Messages',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      immersive: true,
    },
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.CHAT}/:id`,
        name: 'Chat Detail',
        meta: {
          topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          immersive: true,
        },
        access: AUTH_ACCESS,
      },
    ],
  },

  // Halaman Tambahan dari Build Logs (Legal, Info, Community, CRM, Learning)
  {
    path: RoutePath.ABOUT,
    name: 'About',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.CONTACT,
    name: 'Contact',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.COMMUNITY,
    name: 'Community',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.COMMUNITY}/groups/:slug`,
        name: 'Community Group Detail',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
    ],
  },
  {
    path: RoutePath.CRM,
    name: 'CRM',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
  },
  {
    path: RoutePath.BLOG,
    name: 'Blog',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: `${RoutePath.BLOG}/:slug`,
        name: 'Blog Article',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
        },
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.EDUCATION,
    name: 'Education',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
  },
  {
    path: RoutePath.LEARN,
    name: 'Learn',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: AUTH_ACCESS,
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
    children: [
      {
        path: `${RoutePath.LEARN}/:slug`,
        name: 'Lesson Detail',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
        },
        access: AUTH_ACCESS,
      },
    ],
  },
  {
    path: RoutePath.LAINNYA,
    name: 'Lainnya',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: PUBLIC_ACCESS,
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
    shared: true,
  },
  {
    path: RoutePath.UMKM,
    name: 'UMKM Portal',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      immersive: true,
      routeIntent: 'map-discovery',
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.COOKIE_POLICY,
    name: 'Cookie Policy',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.PRIVACY,
    name: 'Privacy Policy',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.REFUND_POLICY,
    name: 'Refund & Return Policy',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.TERMS,
    name: 'Terms',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
  },
  {
    path: RoutePath.TRUST,
    name: 'Trust',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
    children: [
      {
        path: `${RoutePath.TRUST}/:topic`,
        name: 'Trust Topic',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
        },
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },
  {
    path: RoutePath.TOKO,
    name: 'Toko',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
      footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
    },
    access: PUBLIC_ACCESS,
    shared: true,
    isDisabled: true, // 🚧 Ubah jadi true jika ingin menendang halaman ini ke Home
    children: [
      {
        path: `${RoutePath.TOKO}/scan`,
        name: 'Scan QR Toko',
        meta: {
          topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.TOKO}/:slug`,
        name: 'Storefront View',
        meta: {
          topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: true },
          footer: { isVisibleOnWeb: true, isVisibleOnMobile: true },
        },
        access: PUBLIC_ACCESS,
        shared: true,
      },
    ],
  },

  // Portal Manajemen Usaha / Merchant Dashboard (`/[locale]/usaha/...`)
  {
    path: RoutePath.USAHA,
    name: 'Portal Usaha',
    meta: {
      topbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
      navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
    children: [
      {
        path: `${RoutePath.USAHA}/analytics`,
        name: 'Analytics Usaha',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/asisten`,
        name: 'Asisten AI Usaha',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/dashboard`,
        name: 'Dashboard Usaha Core',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/katalog`,
        name: 'Katalog Produk Usaha',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/onboarding`,
        name: 'Onboarding Usaha Baru',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: true },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/operasional`,
        name: 'Operasional Toko',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/order`,
        name: 'Order Management',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/profil`,
        name: 'Profil Management',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/qr`,
        name: 'QR Settings',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/tim`,
        name: 'Team Access',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/toko/:storeId`,
        name: 'Outlet Control',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
      {
        path: `${RoutePath.USAHA}/toko/:storeId/:workspace`,
        name: 'Workspace Outlet',
        meta: {
          navbar: { isVisibleOnWeb: true, isVisibleOnMobile: false },
          bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
          footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
        },
        access: AUTH_ACCESS,
      },
    ],
  },

  // Auth routes (guest only)
  {
    path: RoutePath.LOGIN,
    name: 'Login',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
  {
    path: RoutePath.REGISTER,
    name: 'Register',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
  {
    path: RoutePath.ONBOARDING,
    name: 'Account Onboarding',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    access: AUTH_ACCESS,
  },
  {
    path: RoutePath.FORGOT_PASSWORD,
    name: 'Forgot Password',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
  {
    path: RoutePath.RESET_PASSWORD,
    name: 'Reset Password',
    meta: {
      topbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      navbar: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      bottomNav: { isVisibleOnWeb: false, isVisibleOnMobile: false },
      footer: { isVisibleOnWeb: false, isVisibleOnMobile: false },
    },
    guestOnly: true,
    shared: true,
    access: [Role.GUEST],
  },
];
