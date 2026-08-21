import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DETAILS_FIELD_MASK = 'photos.name,photos.authorAttributions,googleMapsUri';
const NO_STORE = 'private, no-store';

type GooglePlacePhoto = {
  name?: unknown;
  authorAttributions?: unknown;
};

function errorResponse(error: string, status = 404) {
  return NextResponse.json(
    { error },
    { status, headers: { 'Cache-Control': NO_STORE } },
  );
}

function readApiKey() {
  return (
    process.env.GOOGLE_PLACES_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    ''
  );
}

function cleanPlaceId(value: string | null) {
  const text = String(value || '')
    .trim()
    .replace(/^places\//, '');
  return /^[A-Za-z0-9_-]{4,256}$/.test(text) ? text : '';
}

function clampMaxWidth(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 800;
  return Math.min(Math.max(Math.round(parsed), 128), 1200);
}

function encodeResourcePath(value: string) {
  return value
    .split('/')
    .map(part => encodeURIComponent(part))
    .join('/');
}

function canDisplayWithoutAuthorUi(photo: GooglePlacePhoto) {
  const attributions = photo.authorAttributions;
  return !Array.isArray(attributions) || attributions.length === 0;
}

export async function GET(req: NextRequest) {
  const apiKey = readApiKey();
  if (!apiKey) return errorResponse('google_places_key_missing');

  const placeId = cleanPlaceId(req.nextUrl.searchParams.get('placeId'));
  if (!placeId) return errorResponse('invalid_place_id', 400);

  const maxWidth = clampMaxWidth(req.nextUrl.searchParams.get('maxWidth'));
  const placeResource = encodeResourcePath(`places/${placeId}`);

  const detailsResponse = await fetch(
    `https://places.googleapis.com/v1/${placeResource}`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': DETAILS_FIELD_MASK,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    },
  ).catch(() => null);

  if (!detailsResponse?.ok) {
    return errorResponse('google_place_photo_unavailable');
  }

  const details = (await detailsResponse.json().catch(() => null)) as {
    photos?: GooglePlacePhoto[];
  } | null;
  const photos = Array.isArray(details?.photos) ? details.photos : [];
  const photo = photos.find(
    candidate =>
      typeof candidate.name === 'string' && canDisplayWithoutAuthorUi(candidate),
  );
  if (!photo || typeof photo.name !== 'string') {
    return errorResponse('google_photo_requires_attribution_ui');
  }

  const mediaResource = encodeResourcePath(`${photo.name}/media`);
  const mediaUrl = new URL(`https://places.googleapis.com/v1/${mediaResource}`);
  mediaUrl.searchParams.set('maxWidthPx', String(maxWidth));
  mediaUrl.searchParams.set('skipHttpRedirect', 'true');

  const mediaResponse = await fetch(mediaUrl, {
    headers: { 'X-Goog-Api-Key': apiKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);

  if (!mediaResponse?.ok) {
    return errorResponse('google_place_photo_unavailable');
  }

  const media = (await mediaResponse.json().catch(() => null)) as {
    photoUri?: unknown;
  } | null;
  if (typeof media?.photoUri !== 'string' || !media.photoUri) {
    return errorResponse('google_place_photo_unavailable');
  }

  const response = NextResponse.redirect(media.photoUri, 302);
  response.headers.set('Cache-Control', NO_STORE);
  return response;
}
