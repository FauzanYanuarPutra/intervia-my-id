'use client';

import { useEffect } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';
import { buildCreatePath } from '@/lib/createRoutes';

export default function JobCreateRedirect() {
  const router = useRouter();
  const locale = useLocale();

  useEffect(() => {
    router.replace(buildCreatePath({ locale, side: 'demand', type: 'job' }));
  }, [locale, router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <p className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">Redirecting...</p>
    </div>
  );
}
