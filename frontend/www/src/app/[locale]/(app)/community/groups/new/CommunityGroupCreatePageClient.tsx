'use client';

import { CommunityGroupCreateForm } from '@/components/community/CommunityFeedClient';
import { useRouter } from '@/i18n/navigation';

export default function CommunityGroupCreatePageClient({
  isId,
}: {
  isId: boolean;
}) {
  const router = useRouter();

  return (
    <main className="min-h-[100svh] bg-[color:var(--app-surface-muted)] px-0 py-3 sm:px-4 sm:py-8">
      <CommunityGroupCreateForm
        isId={isId}
        onCancel={() => router.push('/community')}
        onCreated={() => router.replace('/community?tab=community')}
      />
    </main>
  );
}
