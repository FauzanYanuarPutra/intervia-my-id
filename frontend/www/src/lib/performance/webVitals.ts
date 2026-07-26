export type WebVitalName = 'CLS' | 'FCP' | 'INP' | 'LCP' | 'TTFB' | string;

export type WebVitalMetricInput = {
  id: string;
  name: WebVitalName;
  label?: string;
  value: number;
  delta: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
};

export type StoredWebVital = Omit<WebVitalMetricInput, 'rating'> & {
  value: number;
  delta: number;
  rating: 'good' | 'needs-improvement' | 'poor' | 'unknown';
};

const THRESHOLDS: Record<string, [number, number]> = {
  CLS: [0.1, 0.25],
  FCP: [1800, 3000],
  INP: [200, 500],
  LCP: [2500, 4000],
  TTFB: [800, 1800],
};

export function classifyWebVital(
  name: WebVitalName,
  value: number,
): StoredWebVital['rating'] {
  const threshold = THRESHOLDS[name];
  if (!threshold || !Number.isFinite(value)) return 'unknown';
  if (value <= threshold[0]) return 'good';
  if (value <= threshold[1]) return 'needs-improvement';
  return 'poor';
}

export function normalizeWebVital(
  metric: WebVitalMetricInput,
): StoredWebVital {
  return {
    id: metric.id.slice(0, 128),
    name: metric.name,
    label: metric.label,
    value: Number(metric.value.toFixed(metric.name === 'CLS' ? 4 : 2)),
    delta: Number(metric.delta.toFixed(metric.name === 'CLS' ? 4 : 2)),
    rating: metric.rating || classifyWebVital(metric.name, metric.value),
    navigationType: metric.navigationType,
  };
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function shouldSampleWebVitals(
  sessionId: string,
  configuredRate: string | undefined,
  production: boolean,
): boolean {
  if (!production) return true;
  const parsed = Number(configuredRate ?? '0.1');
  const rate = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.1;
  return rate > 0 && stableBucket(sessionId) < rate;
}
