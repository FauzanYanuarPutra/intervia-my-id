export type BusinessDiscoveryRankable = {
  distanceKm?: number | null;
  verified?: boolean | null;
  hasMedia?: boolean | null;
  likeCount?: number | null;
  priceCents?: number | null;
  updatedAt?: number | null;
};

function readUsableDistance(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function readNonNegativeNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

export function getBusinessServiceabilityScore(
  item: BusinessDiscoveryRankable,
): number {
  const distanceKm = readUsableDistance(item.distanceKm);
  const distanceScore =
    distanceKm === null ? 0 : Math.max(0, 500 - Math.min(distanceKm, 500));
  const trustScore = item.verified ? 80 : 0;
  const mediaScore = item.hasMedia ? 30 : 0;
  const engagementScore = Math.min(30, readNonNegativeNumber(item.likeCount));
  const priceSignalScore = readNonNegativeNumber(item.priceCents) > 0 ? 5 : 0;

  return (
    distanceScore +
    trustScore +
    mediaScore +
    engagementScore +
    priceSignalScore
  );
}

export function compareBusinessServiceability(
  left: BusinessDiscoveryRankable,
  right: BusinessDiscoveryRankable,
): number {
  const leftDistance = readUsableDistance(left.distanceKm);
  const rightDistance = readUsableDistance(right.distanceKm);

  if (leftDistance !== null && rightDistance !== null) {
    const distanceDiff = leftDistance - rightDistance;
    if (Math.abs(distanceDiff) > 0.05) return distanceDiff;
  } else if (leftDistance !== null) {
    return -1;
  } else if (rightDistance !== null) {
    return 1;
  }

  const scoreDiff =
    getBusinessServiceabilityScore(right) - getBusinessServiceabilityScore(left);
  if (scoreDiff !== 0) return scoreDiff;

  return (
    readNonNegativeNumber(right.updatedAt) -
    readNonNegativeNumber(left.updatedAt)
  );
}
