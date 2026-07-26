'use client';

import { useReportWebVitals } from 'next/web-vitals';
import {
  getLajukanSessionId,
  trackLajukanEvent,
} from '@/lib/analytics/lajukanEvents';
import {
  normalizeWebVital,
  shouldSampleWebVitals,
  type StoredWebVital,
  type WebVitalMetricInput,
} from '@/lib/performance/webVitals';

const VITALS_STORAGE_KEY = 'lajukan:web-vitals:v1';

function readStoredVitals(): StoredWebVital[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(VITALS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredWebVital[]) : [];
  } catch {
    return [];
  }
}

function writeStoredVitals(metrics: StoredWebVital[]) {
  try {
    window.sessionStorage.setItem(VITALS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // Ignore storage failures in private modes or restricted environments.
  }
}

function pushMetric(metricInput: WebVitalMetricInput) {
  if (typeof window === 'undefined') return;
  const metric = normalizeWebVital(metricInput);

  const next = [
    ...readStoredVitals().filter(item => item.id !== metric.id),
    metric,
  ].slice(-24);
  (
    window as Window & { __LAJUKAN_WEB_VITALS__?: StoredWebVital[] }
  ).__LAJUKAN_WEB_VITALS__ = next;
  writeStoredVitals(next);

  if (process.env.NODE_ENV !== 'production') {
    console.info('[WEB_VITALS]', metric.name, metric.value, metric);
  }

  const sessionId = getLajukanSessionId();
  if (
    shouldSampleWebVitals(
      sessionId,
      process.env.NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE,
      process.env.NODE_ENV === 'production',
    )
  ) {
    const connection = (
      navigator as Navigator & {
        connection?: { effectiveType?: string; saveData?: boolean };
        deviceMemory?: number;
      }
    ).connection;
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;

    void trackLajukanEvent('performance.web_vital', {
      page: window.location.pathname,
      sessionId,
      properties: {
        metric: metric.name,
        value: metric.value,
        delta: metric.delta,
        rating: metric.rating,
        navigation_type: metric.navigationType,
        hardware_concurrency: navigator.hardwareConcurrency,
        device_memory_gb: deviceMemory,
        connection_type: connection?.effectiveType,
        save_data: connection?.saveData,
      },
      context: { referrer: undefined },
    });
  }
}

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    pushMetric(metric as WebVitalMetricInput);
  });

  return null;
}
