'use client';

import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { createListingDraftRecoveryFetch } from '@/lib/create/listingDraftRecoveryFetch';

type ListingDraftRecoveryBoundaryProps = {
  children: ReactNode;
};

export default function ListingDraftRecoveryBoundary({
  children,
}: ListingDraftRecoveryBoundaryProps) {
  const { user } = useAuth();
  const ownerId = user?.id?.trim() || '';

  useEffect(() => {
    if (!ownerId || typeof window === 'undefined') return;

    const originalFetch = window.fetch;
    const recoveryFetch = createListingDraftRecoveryFetch({
      ownerId,
      baseFetch: (input, init) => originalFetch(input, init),
      baseUrl: window.location.origin,
    });

    window.fetch = recoveryFetch;

    return () => {
      if (window.fetch === recoveryFetch) {
        window.fetch = originalFetch;
      }
    };
  }, [ownerId]);

  return children;
}
