'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { JobDetail } from '@/components/ui-kit';
import { MarketPageFrame } from '@/components/marketplace';
import { DetailMobileTopBar } from '@/components/layout/DetailMobileTopBar';
import { useAppBack } from '@/lib/navigation/useAppBack';

type JobDetailData = Record<string, unknown> & { id?: React.Key };

export default function JobDetailClient({
  job,
  locale = 'id',
}: {
  job: JobDetailData;
  locale?: string;
}) {
  const router = useRouter();
  const localeCode = locale === 'en' ? 'en' : 'id';
  const handleBack = useAppBack(router, `/${localeCode}/jobs`);
  const jobTitle =
    typeof job.title === 'string' && job.title.trim()
      ? job.title
      : typeof job.name === 'string' && job.name.trim()
        ? job.name
        : localeCode === 'id'
          ? 'Detail lowongan'
          : 'Job detail';

  return (
    <MarketPageFrame
      variant="detail"
      className="lajukan-market-job bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-overlay)]"
    >
      <DetailMobileTopBar
        title={jobTitle}
        eyebrow={localeCode === 'id' ? 'Detail lowongan' : 'Job detail'}
        backLabel={localeCode === 'id' ? 'Kembali' : 'Back'}
      />
      <JobDetail
        job={job}
        onBack={handleBack}
      />
    </MarketPageFrame>
  );
}
