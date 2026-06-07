'use client';

import React, { Suspense, useEffect } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ChatInboxProvider } from '@/context/ChatInboxContext';
import { NotificationInboxProvider } from '@/context/NotificationInboxContext';
import { SectorProvider } from '@/context/SectorContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UISettingsProvider } from '@/context/UISettingsContext';
import { PageMetaProviderWrapper } from '@/components/providers/PageMetaProviderWrapper';
import { DialogProvider } from '@/components/system/feedback/DialogProvider';
import { BrowserNotificationBridge } from '@/components/system/feedback/BrowserNotificationBridge';
import { ToastProvider } from '@/components/system/feedback/ToastProvider';
import { ClientSecurityGuards } from '@/components/common/ClientSecurityGuards';
import { GlobalImageFallback } from '@/components/common/GlobalImageFallback';
import { LajukanEventBridge } from '@/components/analytics/LajukanEventBridge';

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NEXT_PUBLIC_DISABLE_PWA === 'false') return;

    const markerKey = 'lajukan:pwa-cleanup:v1';
    if (window.localStorage.getItem(markerKey) === 'done') return;

    const unregisterStaleWorkers = async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registrations =
            await navigator.serviceWorker.getRegistrations();
          await Promise.all(
            registrations.map(async registration => {
              const scriptUrl =
                registration.active?.scriptURL ||
                registration.waiting?.scriptURL ||
                registration.installing?.scriptURL ||
                '';

              if (scriptUrl.includes('/notification-sw.js')) {
                return false;
              }

              return registration.unregister();
            }),
          );
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }
      } catch (error) {
        console.warn('[PWA_CLEANUP_FAILED]', error);
      } finally {
        window.localStorage.setItem(markerKey, 'done');
      }
    };

    void unregisterStaleWorkers();
  }, []);

  return (
    <ThemeProvider>
      <ClientSecurityGuards />
      <GlobalImageFallback />
      <UISettingsProvider>
        <ToastProvider>
          <DialogProvider>
            <AuthProvider>
              <BrowserNotificationBridge />
              <ChatInboxProvider>
                <NotificationInboxProvider>
                  <SectorProvider>
                    <PageMetaProviderWrapper>
                      <Suspense fallback={null}>
                        <LajukanEventBridge />
                      </Suspense>
                      {children}
                    </PageMetaProviderWrapper>
                  </SectorProvider>
                </NotificationInboxProvider>
              </ChatInboxProvider>
            </AuthProvider>
          </DialogProvider>
        </ToastProvider>
      </UISettingsProvider>
    </ThemeProvider>
  );
}
