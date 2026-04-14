'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
// import { JobDetail } from "@/components/ui-kit";

export default function FreelancerDetailClient({ job }: { job: any }) {
  const router = useRouter();

  return (
    <div className="bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-overlay)] min-h-screen">
      {/* <JobDetail
        job={job} 
        onBack={() => router.back()} // Interaksi client-side
      /> */}
    </div>
  );
}