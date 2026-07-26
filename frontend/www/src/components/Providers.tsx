'use client';

import dynamic from 'next/dynamic';
import React, { Suspense, useEffect, useState } from 'react';
import { AuthProvider } from '@/context/AuthContext';
import { ChatInboxProvider } from '@/context/ChatInboxContext';
import { NotificationInboxProvider } from '@/context/NotificationInboxContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { UISettingsProvider } from '@/context/UISettingsContext';
import { PageMetaProviderWrapper } from '@/components/providers/PageMetaProviderWrapper';
import { DialogProvider } from '@/components/system/feedback/DialogProvider';
import { ToastProvider } from '@/components/system/feedback/ToastProvider';
import { GlobalImageFallback } from '@/components/common/GlobalImageFallback';
import { ViewportHeightManager } from '@/components/common/ViewportHeightManager';
import { WebVitalsReporter } from '@/components/analytics/WebVitalsReporter';

const BrowserNotificationBridge = dynamic(
  () =>
    import('@/components/system/feedback/BrowserNotificationBridge').then(
      module => module.BrowserNotificationBridge,
    ),
  { ssr: false },
);

const LajukanEventBridge = dynamic(
  () =>
    import('@/components/analytics/LajukanEventBridge').then(
      module => module.LajukanEventBridge,
    ),
  { ssr: false },
);

type Props = {
  children: React.ReactNode;
};

export function Providers({ children }: Props) {
  const [deferredBridgesReady, setDeferredBridgesReady] = useState(false);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let idleCallbackId: number | undefined;
    const schedule = () => {
      setDeferredBridgesReady(true);
    };

    const browserWindow = globalThis.window;
    if ('requestIdleCallback' in browserWindow) {
      idleCallbackId = browserWindow.requestIdleCallback(schedule, {
        timeout: 1500,
      });
      return () => browserWindow.cancelIdleCallback(idleCallbackId as number);
    }

    const timeoutId = globalThis.setTimeout(schedule, 800);
    return () => globalThis.clearTimeout(timeoutId);
  }, []);

  return (
    <ThemeProvider>
      <ViewportHeightManager />
      <GlobalImageFallback />
      <UISettingsProvider>
        <ToastProvider>
          <DialogProvider>
            <AuthProvider>
              <ChatInboxProvider>
                <NotificationInboxProvider>
                  <PageMetaProviderWrapper>
                    <WebVitalsReporter />
                    <Suspense fallback={null}>
                      {deferredBridgesReady ? <LajukanEventBridge /> : null}
                    </Suspense>
                    {deferredBridgesReady ? (
                      <BrowserNotificationBridge />
                    ) : null}
                    {children}
                  </PageMetaProviderWrapper>
                </NotificationInboxProvider>
              </ChatInboxProvider>
            </AuthProvider>
          </DialogProvider>
        </ToastProvider>
      </UISettingsProvider>
    </ThemeProvider>
  );
}
