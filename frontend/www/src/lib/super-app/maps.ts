export type LatLng = { lat: number; lng: number };

function toRoutePoint(point: LatLng): string {
  return `${point.lat},${point.lng}`;
}

export function buildOsmDirectionsUrl(origin: LatLng, destination: LatLng, via?: LatLng): string {
  const route = via
    ? `${toRoutePoint(origin)};${toRoutePoint(via)};${toRoutePoint(destination)}`
    : `${toRoutePoint(origin)};${toRoutePoint(destination)}`;

  const params = new URLSearchParams({
    engine: 'fossgis_osrm_car',
    route,
  });

  return `https://www.openstreetmap.org/directions?${params.toString()}`;
}

export function buildGoogleMapsOpenUrl(origin: LatLng, destination: LatLng, via?: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    origin: toRoutePoint(origin),
    destination: toRoutePoint(destination),
    travelmode: 'driving',
  });
  if (via) {
    params.set('waypoints', toRoutePoint(via));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsDirectionsUrl(destination: LatLng, origin?: LatLng, via?: LatLng): string {
  const params = new URLSearchParams({
    api: '1',
    destination: toRoutePoint(destination),
    travelmode: 'driving',
  });
  if (origin) {
    params.set('origin', toRoutePoint(origin));
  }
  if (via) {
    params.set('waypoints', toRoutePoint(via));
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function buildGoogleMapsPlaceUrl(destination: LatLng, label?: string): string {
  const query = label?.trim() ? `${label.trim()} @ ${toRoutePoint(destination)}` : toRoutePoint(destination);
  const params = new URLSearchParams({
    api: '1',
    query,
  });
  return `https://www.google.com/maps/search/?${params.toString()}`;
}
