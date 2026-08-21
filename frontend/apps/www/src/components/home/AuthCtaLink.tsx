'use client';

import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import type { ReactNode } from 'react';

type AuthCtaLinkProps = {
  hrefWhenAuth: string;
  hrefWhenGuest: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export function AuthCtaLink({
  hrefWhenAuth,
  hrefWhenGuest,
  className,
  children,
  ariaLabel,
}: AuthCtaLinkProps) {
  const { isAuthenticated, loading } = useAuth();
  const href = !loading && isAuthenticated ? hrefWhenAuth : hrefWhenGuest;

  return (
    <Link href={href} className={className} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
