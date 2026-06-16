'use client';

import { useReportWebVitals } from 'next/web-vitals';

type WebVitalsMetric = {
  id: string;
  name: string;
  label: string;
  value: number;
  delta: number;
  entries?: PerformanceEntry[];
  navigationType?: string;
};

const VITALS_STORAGE_KEY = 'lajukan:web-vitals:v1';

function readStoredVitals(): WebVitalsMetric[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(VITALS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WebVitalsMetric[]) : [];
  } catch {
    return [];
  }
}

function writeStoredVitals(metrics: WebVitalsMetric[]) {
  try {
    window.sessionStorage.setItem(VITALS_STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // Ignore storage failures in private modes or restricted environments.
  }
}

function pushMetric(metric: WebVitalsMetric) {
  if (typeof window === 'undefined') return;

  const next = [...readStoredVitals().filter(item => item.id !== metric.id), metric].slice(-24);
  (window as Window & { __LAJUKAN_WEB_VITALS__?: WebVitalsMetric[] }).__LAJUKAN_WEB_VITALS__ = next;
  writeStoredVitals(next);

  if (process.env.NODE_ENV !== 'production') {
    const rounded = Number(metric.value.toFixed(2));
    console.info('[WEB_VITALS]', metric.name, rounded, metric);
  }
}

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    pushMetric(metric as WebVitalsMetric);
  });

  return null;
}
