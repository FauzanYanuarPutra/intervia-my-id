export type ProjectActivityItem = {
  title: string;
  statusKey: string;
  offerCount: number;
};

export type ProjectActivitySummary = {
  totalRequests: number;
  activeCount: number;
  waitingCount: number;
  completedCount: number;
  totalOffers: number;
  noOfferCount: number;
  averageOffers: number;
  completionRate: number;
  attentionProjectTitle: string;
};

function normalizedOfferCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function summarizeProjectActivity(
  items: ProjectActivityItem[],
): ProjectActivitySummary {
  const completedCount = items.filter(
    item => item.statusKey === 'completed',
  ).length;
  const activeItems = items.filter(item => item.statusKey !== 'completed');
  const waitingItems = activeItems.filter(item => item.statusKey === 'waiting');
  const noOfferItems = activeItems.filter(
    item => normalizedOfferCount(item.offerCount) === 0,
  );
  const totalOffers = items.reduce(
    (total, item) => total + normalizedOfferCount(item.offerCount),
    0,
  );
  const attentionProject =
    waitingItems[0] || noOfferItems[0] || activeItems[0] || items[0];

  return {
    totalRequests: items.length,
    activeCount: activeItems.length,
    waitingCount: waitingItems.length,
    completedCount,
    totalOffers,
    noOfferCount: noOfferItems.length,
    averageOffers:
      items.length > 0 ? Math.round((totalOffers / items.length) * 10) / 10 : 0,
    completionRate:
      items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
    attentionProjectTitle:
      attentionProject?.title || 'Belum ada proyek yang perlu ditinjau',
  };
}
