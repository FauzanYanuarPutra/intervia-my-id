'use client';

import ClientBottomNav from '@/components/layout/ClientBottomNav';

type HomeMobileBottomNavProps = {
  locale: 'id' | 'en';
};

export function HomeMobileBottomNav(_props: HomeMobileBottomNavProps) {
  return <ClientBottomNav />;
}

export default HomeMobileBottomNav;
