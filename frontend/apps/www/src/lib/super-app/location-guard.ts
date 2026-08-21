export type LatLng = { lat: number; lng: number };

export type LocationAnomalyAssessment = {
  isAnomaly: boolean;
  shouldReject: boolean;
  reason?: 'invalid_coordinate' | 'teleport' | 'impossible_speed';
  distanceKm: number;
  elapsedSec: number;
  speedKmh: number;
};

function toRad(value: number): number {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return r * (2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

export function isCoordinateValid(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

export function detectLocationAnomaly(input: {
  previous?: { lat: number; lng: number; updatedAt?: string | Date } | null;
  next: LatLng;
  now?: Date;
  hardRejectSpeedKmh?: number;
  hardRejectTeleportKm?: number;
}): LocationAnomalyAssessment {
  if (!isCoordinateValid(input.next)) {
    return {
      isAnomaly: true,
      shouldReject: true,
      reason: 'invalid_coordinate',
      distanceKm: 0,
      elapsedSec: 0,
      speedKmh: 0,
    };
  }

  const previous = input.previous;
  if (!previous || !isCoordinateValid({ lat: previous.lat, lng: previous.lng })) {
    return {
      isAnomaly: false,
      shouldReject: false,
      distanceKm: 0,
      elapsedSec: 0,
      speedKmh: 0,
    };
  }

  const now = input.now || new Date();
  const previousTs = previous.updatedAt ? new Date(previous.updatedAt).getTime() : NaN;
  const elapsedSec = Number.isFinite(previousTs) ? Math.max(0, (now.getTime() - previousTs) / 1000) : 0;
  if (elapsedSec <= 0) {
    return {
      isAnomaly: false,
      shouldReject: false,
      distanceKm: 0,
      elapsedSec: 0,
      speedKmh: 0,
    };
  }

  const distanceKm = haversineKm(
    { lat: previous.lat, lng: previous.lng },
    input.next,
  );
  const speedKmh = (distanceKm / elapsedSec) * 3600;
  const hardRejectSpeedKmh = input.hardRejectSpeedKmh || 220;
  const hardRejectTeleportKm = input.hardRejectTeleportKm || 6;

  if (speedKmh > hardRejectSpeedKmh) {
    return {
      isAnomaly: true,
      shouldReject: true,
      reason: 'impossible_speed',
      distanceKm,
      elapsedSec,
      speedKmh,
    };
  }

  if (distanceKm >= hardRejectTeleportKm && elapsedSec <= 20) {
    return {
      isAnomaly: true,
      shouldReject: true,
      reason: 'teleport',
      distanceKm,
      elapsedSec,
      speedKmh,
    };
  }

  if (speedKmh > 140 || (distanceKm >= 2 && elapsedSec < 30)) {
    return {
      isAnomaly: true,
      shouldReject: false,
      reason: speedKmh > 140 ? 'impossible_speed' : 'teleport',
      distanceKm,
      elapsedSec,
      speedKmh,
    };
  }

  return {
    isAnomaly: false,
    shouldReject: false,
    distanceKm,
    elapsedSec,
    speedKmh,
  };
}

