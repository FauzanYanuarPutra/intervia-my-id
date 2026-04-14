'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';

export default function MyApplicationsRedirect() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(`/dashboard`);
  }, [locale, router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">Redirecting...</p>
    </div>
  );
}