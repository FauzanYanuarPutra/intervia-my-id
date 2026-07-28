'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CommunityGroupSettingsForm } from '@/components/community/CommunityGroupDetailClient';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/i18n/navigation';
import type { CommunityGroup } from '@/lib/community/types';

type GroupPayload = {
  data?: CommunityGroup;
  group?: CommunityGroup;
  error?: string;
};

export default function CommunityGroupSettingsPageClient({
  isId,
  slug,
}: {
  isId: boolean;
  slug: string;
}) {
  const router = useRouter();
  const { authFetch } = useAuth();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    authFetch(`/api/community/groups/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    })
      .then(async response => {
        const payload = (await response.json().catch(() => ({}))) as GroupPayload;
        if (!response.ok) throw new Error(payload.error || 'Failed to load group');
        if (active) setGroup(payload.data || payload.group || null);
      })
      .catch(reason => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : isId
                ? 'Group tidak dapat dimuat'
                : 'Group could not be loaded',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [authFetch, isId, slug]);

  const detailHref = `/community/groups/${encodeURIComponent(slug)}`;

  return (
    <main className="min-h-[100svh] bg-[color:var(--app-surface-muted)] px-0 py-3 sm:px-4 sm:py-8">
      {error ? (
        <div className="mx-auto max-w-xl rounded-2xl bg-[color:var(--app-danger-soft)] p-5 text-sm text-[color:var(--app-danger)]">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => router.push(detailHref)}
            className="mt-4 min-h-10 rounded-full bg-white px-4 font-bold"
          >
            {isId ? 'Kembali ke group' : 'Back to group'}
          </button>
        </div>
      ) : group ? (
        <CommunityGroupSettingsForm
          key={`${group.id}:${group.name}`}
          group={group}
          isId={isId}
          onCancel={() => router.push(detailHref)}
          onSaved={nextGroup => {
            router.replace(
              `/community/groups/${encodeURIComponent(nextGroup.slug || slug)}`,
            );
          }}
        />
      ) : (
        <div className="grid min-h-[50svh] place-items-center">
          <Loader2 className="h-7 w-7 animate-spin text-[color:var(--app-accent)]" />
        </div>
      )}
    </main>
  );
}
