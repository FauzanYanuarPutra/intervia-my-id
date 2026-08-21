export function formatDistanceKm(
  distanceKm: number | null | undefined,
): string | null {
  if (
    typeof distanceKm !== 'number' ||
    !Number.isFinite(distanceKm) ||
    distanceKm < 0
  ) {
    return null;
  }

  if (distanceKm < 1) {
    const meters =
      distanceKm === 0 ? 0 : Math.max(1, Math.round(distanceKm * 1000));
    return `${meters} m`;
  }

  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}
