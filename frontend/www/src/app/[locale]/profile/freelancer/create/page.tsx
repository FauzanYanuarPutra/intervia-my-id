'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';

export default function FreelancerCreateRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/profile/edit?focus=talent');
  }, [router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">Redirecting...</p>
    </div>
  );
}
