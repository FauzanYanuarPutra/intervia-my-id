import React from 'react';
import AuthGuard from '@/context/AuthGuard';

export default function LocaleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGuard>{children}</AuthGuard>;
}