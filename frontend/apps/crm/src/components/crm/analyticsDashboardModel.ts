import type { DashboardData, ChartPoint } from './models';

export type TrendMetric =
  | 'registrations'
  | 'listings'
  | 'businesses'
  | 'orders'
  | 'support'
  | 'pipeline';

export type TrendRange = 7 | 30 | 90;
export type ChartStyle = 'line' | 'bar' | 'area';
export type BreakdownMetric = 'listings' | 'orders' | 'kyc' | 'pipeline';

type Timestamped = {
  created_at?: string | null;
};

function validTime(value?: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function dateKey(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

function formatDayLabel(time: number, range: TrendRange): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    ...(range === 90 ? { year: '2-digit' } : {}),
    timeZone: 'Asia/Jakarta',
  }).format(new Date(time));
}

function activityIsRegistration(action: string): boolean {
  const normalized = action.toLowerCase();
  return normalized.includes('register') || normalized.includes('signup') || normalized.includes('sign_up');
}

function metricTimes(data: DashboardData, metric: TrendMetric): number[] {
  switch (metric) {
    case 'registrations':
      return data.activities
        .filter(item => activityIsRegistration(item.title) || activityIsRegistration(item.body))
        .map(item => validTime(item.at))
        .filter((value): value is number => value !== null);
    case 'listings':
      return data.listings
        .map(item => validTime(item.createdAt || item.updatedAt))
        .filter((value): value is number => value !== null);
    case 'businesses':
      return data.businesses
        .map(item => validTime(item.created_at))
        .filter((value): value is number => value !== null);
    case 'orders':
      return data.orders
        .map(item => validTime(item.created_at))
        .filter((value): value is number => value !== null);
    case 'support':
      return data.tickets
        .map(item => validTime(item.created_at))
        .filter((value): value is number => value !== null);
    case 'pipeline':
      return data.leads
        .map(item => validTime(item.created_at))
        .filter((value): value is number => value !== null);
  }
}

export function buildTrendSeries(
  data: DashboardData,
  metric: TrendMetric,
  range: TrendRange,
  now = Date.now(),
): ChartPoint[] {
  const bucketDays = range === 90 ? 7 : 1;
  const bucketCount = range === 90 ? 13 : range;
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);

  const points: ChartPoint[] = [];
  const counts = new Map<string, number>();
  const times = metricTimes(data, metric);

  for (let index = bucketCount - 1; index >= 0; index -= 1) {
    const bucketTime = end.getTime() - index * bucketDays * 86_400_000;
    const key = dateKey(bucketTime);
    points.push({
      label: formatDayLabel(bucketTime, range),
      value: 0,
    });
    counts.set(key, 0);
  }

  const firstBucketTime = end.getTime() - (bucketCount - 1) * bucketDays * 86_400_000;
  for (const time of times) {
    if (time < firstBucketTime) continue;
    const deltaDays = Math.floor((time - firstBucketTime) / 86_400_000);
    const bucketIndex = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor(deltaDays / bucketDays)),
    );
    const bucketTime = firstBucketTime + bucketIndex * bucketDays * 86_400_000;
    const key = dateKey(bucketTime);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return points.map((point, index) => {
    const bucketTime = firstBucketTime + index * bucketDays * 86_400_000;
    return {
      label: point.label,
      value: counts.get(dateKey(bucketTime)) || 0,
    };
  });
}

export function buildBreakdown(
  data: DashboardData,
  metric: BreakdownMetric,
): Array<{ label: string; value: number }> {
  const buckets = new Map<string, number>();

  const add = (label: string, value = 1) => {
    const normalized = label.trim() || 'Lainnya';
    buckets.set(normalized, (buckets.get(normalized) || 0) + value);
  };

  if (metric === 'listings') {
    for (const listing of data.listings) {
      add(
        listing.status === 'active'
          ? 'Aktif'
          : listing.status === 'draft'
            ? 'Draft'
            : listing.status === 'rejected'
              ? 'Ditolak'
              : 'Menunggu',
      );
    }
  }

  if (metric === 'orders') {
    for (const order of data.orders) {
      add(order.status.replaceAll('_', ' ') || 'Tidak diketahui');
    }
  }

  if (metric === 'kyc') {
    for (const user of data.users) {
      add(user.kyc);
    }
  }

  if (metric === 'pipeline') {
    for (const lead of data.leads) {
      add(lead.stage.replaceAll('_', ' ') || 'Tidak diketahui');
    }
  }

  return [...buckets.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 8);
}

export function sumOrderValue(data: DashboardData): number {
  return data.orders.reduce(
    (sum, order) =>
      sum + Math.max(0, order.amount_final_cents || order.amount_estimate_cents || 0),
    0,
  );
}

export function countNewInRange(
  data: DashboardData,
  metric: TrendMetric,
  range: TrendRange,
  now = Date.now(),
): number {
  const start = now - range * 86_400_000;
  return metricTimes(data, metric).filter(time => time >= start && time <= now).length;
}
