'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useLocale } from 'next-intl';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

function extractContentId(value: string): string {
  const clean = value.trim();
  if (!clean) return '';
  const match = clean.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i);
  return match ? match[1] : clean;
}

export default function EditContentPage({ params }: PageProps) {
  const router = useRouter();
  const locale = useLocale() || 'id';
  const [message, setMessage] = useState(locale === 'id' ? 'Mengalihkan ke form listing...' : 'Redirecting to listing form...');

  useEffect(() => {
    let mounted = true;
    params.then((resolved) => {
      if (!mounted) return;
      const id = extractContentId(resolved.id);
      if (!id) {
        router.push('/explore');
        return;
      }
      router.replace(`/create?draft=${id}`);
    });
    return () => {
      mounted = false;
    };
  }, [params, router]);

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)] flex items-center justify-center">
      <p className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">{message}</p>
    </div>
  );
}