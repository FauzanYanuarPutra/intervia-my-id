export type LatLng = {
  lat: number;
  lng: number;
};

export const DEFAULT_BUSINESS_POINT: LatLng = {
  lat: -6.175392,
  lng: 106.827153,
};

function cleanText(value: string | null | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function toFixedCoordinate(value: number) {
  return Number(value.toFixed(6));
}

function isValidCoordinatePair(lat: number, lng: number) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function parseCoordinatePair(value: string) {
  const match = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!match) {
    return null;
  }

  const lat = Number(match[1]);
  const lng = Number(match[2]);

  if (!isValidCoordinatePair(lat, lng)) {
    return null;
  }

  return {
    lat: toFixedCoordinate(lat),
    lng: toFixedCoordinate(lng),
  } satisfies LatLng;
}

function buildGooglePoint(point: LatLng) {
  return `${point.lat},${point.lng}`;
}

export function normalizeLatLng(point: LatLng): LatLng {
  return {
    lat: toFixedCoordinate(point.lat),
    lng: toFixedCoordinate(point.lng),
  };
}

export function toLatLng(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const point = {
    lat: Number(latitude),
    lng: Number(longitude),
  };

  return isValidCoordinatePair(point.lat, point.lng) ? normalizeLatLng(point) : null;
}

export function parseLatLngFromMapsInput(value: string | null | undefined) {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const directPair = parseCoordinatePair(text);
  if (directPair) {
    return directPair;
  }

  if (!/^https?:\/\//i.test(text)) {
    return null;
  }

  try {
    const url = new URL(text);
    for (const key of ['q', 'query', 'll', 'center', 'destination', 'origin']) {
      const fromParam = parseCoordinatePair(cleanText(url.searchParams.get(key)));
      if (fromParam) {
        return fromParam;
      }
    }

    const fromAtMarker = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (fromAtMarker) {
      return parseCoordinatePair(`${fromAtMarker[1]},${fromAtMarker[2]}`);
    }

    const fromBangMarker = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (fromBangMarker) {
      return parseCoordinatePair(`${fromBangMarker[1]},${fromBangMarker[2]}`);
    }
  } catch {
    return null;
  }

  return null;
}

export function buildGoogleMapsSearchUrl(query: string) {
  const params = new URLSearchParams({
    api: '1',
    query,
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}

export function buildGoogleMapsPlaceUrl(destination: LatLng, label?: string) {
  const query = cleanText(label)
    ? `${cleanText(label)} @ ${buildGooglePoint(destination)}`
    : buildGooglePoint(destination);
  const params = new URLSearchParams({
    api: '1',
    query,
  });

  return `https://www.google.com/maps/search/?${params.toString()}`;
}
