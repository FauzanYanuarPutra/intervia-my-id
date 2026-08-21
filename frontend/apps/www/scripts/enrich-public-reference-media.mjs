#!/usr/bin/env node

/**
 * Enrich non-transactional public-reference content with reusable Wikimedia
 * media.
 *
 * Safety boundary:
 * - auto-apply only an exact OSM `wikimedia_commons=File:*` value;
 * - auto-apply a curated Commons File already attached to a
 *   `real_open_data_reference`, but mark it as contextual rather than proof of
 *   a specific active business;
 * - Wikimedia Commons Category values are audit-only;
 * - Wikidata P18 is audit-only unless a reviewed manifest explicitly maps the
 *   same stable OSM element, Wikidata entity, and P18 file to the same physical
 *   POI;
 * - never search by business name and never fetch Google/arbitrary web photos.
 *
 * Dry-run is the default. Pass --apply for MinIO/database writes.
 */

import {
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

const HARD_MAX_BYTES = 10 * 1024 * 1024;
const JSON_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_LIMIT = 1_000;
const DEFAULT_CONCURRENCY = 3;
const MAX_LIMIT = 50_000;
const MAX_CONCURRENCY = 8;
const FETCH_TIMEOUT_MS = 25_000;
const USER_AGENT =
  'LajukanPublicReferenceMedia/1.0 (https://www.lajukan.com; licensed-media-import)';
const DEFAULT_REVIEWED_MANIFEST = fileURLToPath(
  new URL('../config/public-reference-media.reviewed.json', import.meta.url),
);
const DEFAULT_CURATED_MANIFEST = fileURLToPath(
  new URL('../config/public-reference-media.curated.json', import.meta.url),
);

const API_HOSTS = new Set(['commons.wikimedia.org', 'www.wikidata.org']);
const MEDIA_HOSTS = new Set(['upload.wikimedia.org']);

const MIME_TO_EXTENSION = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PolicyError';
    this.code = code;
  }
}

export function normalizeCommonsFileRef(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replaceAll('_', ' ').normalize('NFC');
  const match = /^File:(.+)$/iu.exec(normalized);
  if (!match) return null;
  const filename = match[1].replace(/\s+/gu, ' ').trim();
  if (
    filename.length < 3 ||
    filename.length > 240 ||
    /[\u0000-\u001f\u007f[\]{}|#?]/u.test(filename) ||
    /^(?:https?:)?\/\//iu.test(filename)
  ) {
    return null;
  }
  return `File:${filename}`;
}

export function isCommonsCategoryRef(value) {
  return (
    typeof value === 'string' &&
    /^Category:.{1,240}$/iu.test(value.trim().replaceAll('_', ' '))
  );
}

export function normalizeCommonsFileUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (
    parsed.protocol !== 'https:' ||
    parsed.hostname.toLowerCase() !== 'commons.wikimedia.org' ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== '443') ||
    parsed.search ||
    parsed.hash ||
    !parsed.pathname.startsWith('/wiki/')
  ) {
    return null;
  }
  let title;
  try {
    title = decodeURIComponent(parsed.pathname.slice('/wiki/'.length));
  } catch {
    return null;
  }
  return normalizeCommonsFileRef(title);
}

export function normalizeWikidataId(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase();
  return /^Q[1-9][0-9]{0,14}$/u.test(normalized) ? normalized : null;
}

export function classifyCommonsLicense(value) {
  const raw =
    typeof value === 'string'
      ? stripMarkup(value).replace(/\s+/gu, ' ').trim()
      : '';
  if (!raw || /\b(?:NC|ND)\b/iu.test(raw)) return null;

  if (/^CC0(?: 1\.0)?$/iu.test(raw)) {
    return {
      key: 'cc0-1.0',
      name: 'CC0 1.0',
      url: 'https://creativecommons.org/publicdomain/zero/1.0/',
      attributionRequired: false,
    };
  }

  if (/^(?:Public domain|Public Domain Mark 1\.0)$/iu.test(raw)) {
    return {
      key: 'public-domain',
      name: 'Public domain',
      url: 'https://creativecommons.org/publicdomain/mark/1.0/',
      attributionRequired: false,
    };
  }

  const attribution = /^CC BY (1\.0|2\.0|2\.5|3\.0|4\.0)$/iu.exec(raw);
  if (attribution) {
    const version = attribution[1];
    return {
      key: `cc-by-${version}`,
      name: `CC BY ${version}`,
      url: `https://creativecommons.org/licenses/by/${version}/`,
      attributionRequired: true,
    };
  }

  const shareAlike = /^CC BY-SA (1\.0|2\.0|2\.5|3\.0|4\.0)$/iu.exec(raw);
  if (shareAlike) {
    const version = shareAlike[1];
    return {
      key: `cc-by-sa-${version}`,
      name: `CC BY-SA ${version}`,
      url: `https://creativecommons.org/licenses/by-sa/${version}/`,
      attributionRequired: true,
    };
  }

  return null;
}

export function validateRemoteUrl(value, kind) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new PolicyError('unsafe_url', 'Remote URL is invalid');
  }

  const allowedHosts = kind === 'media' ? MEDIA_HOSTS : API_HOSTS;
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    (parsed.port && parsed.port !== '443') ||
    !allowedHosts.has(parsed.hostname.toLowerCase())
  ) {
    throw new PolicyError(
      'unsafe_url',
      `Remote ${kind} URL is outside the approved Wikimedia hosts`,
    );
  }
  return parsed;
}

export function detectRasterMime(bytes) {
  if (!Buffer.isBuffer(bytes)) bytes = Buffer.from(bytes);
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function buildObjectKey(sha256, mime) {
  if (!/^[0-9a-f]{64}$/u.test(sha256)) {
    throw new PolicyError('invalid_sha256', 'SHA-256 must be lowercase hex');
  }
  const extension = MIME_TO_EXTENSION.get(mime);
  if (!extension) {
    throw new PolicyError(
      'unsupported_mime',
      'Only JPEG, PNG, and WebP are allowed',
    );
  }
  return `content/public-reference/${sha256.slice(0, 2)}/${sha256}.${extension}`;
}

export function parseCliArgs(argv) {
  const options = {
    apply: false,
    reverify: false,
    help: false,
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    maxBytes: HARD_MAX_BYTES,
    reviewedManifest: DEFAULT_REVIEWED_MANIFEST,
    curatedManifest: DEFAULT_CURATED_MANIFEST,
    auditFile: '',
  };

  const readValue = (argument, index) => {
    const equals = argument.indexOf('=');
    if (equals >= 0) return [argument.slice(equals + 1), index];
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      throw new PolicyError(
        'invalid_arguments',
        `${argument} requires a value`,
      );
    }
    return [argv[index + 1], index + 1];
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const flag = argument.split('=', 1)[0];
    if (flag === '--apply') {
      options.apply = true;
    } else if (flag === '--reverify') {
      options.reverify = true;
    } else if (flag === '--help' || flag === '-h') {
      options.help = true;
    } else if (
      flag === '--limit' ||
      flag === '--concurrency' ||
      flag === '--max-bytes' ||
      flag === '--reviewed-manifest' ||
      flag === '--curated-manifest' ||
      flag === '--audit-file'
    ) {
      const [value, consumedIndex] = readValue(argument, index);
      index = consumedIndex;
      if (flag === '--limit') options.limit = parsePositiveInteger(value, flag);
      if (flag === '--concurrency') {
        options.concurrency = parsePositiveInteger(value, flag);
      }
      if (flag === '--max-bytes') {
        options.maxBytes = parsePositiveInteger(value, flag);
      }
      if (flag === '--reviewed-manifest') options.reviewedManifest = value;
      if (flag === '--curated-manifest') options.curatedManifest = value;
      if (flag === '--audit-file') options.auditFile = value;
    } else {
      throw new PolicyError(
        'invalid_arguments',
        `Unknown argument: ${argument}`,
      );
    }
  }

  if (options.limit > MAX_LIMIT) {
    throw new PolicyError(
      'invalid_arguments',
      `--limit cannot exceed ${MAX_LIMIT}`,
    );
  }
  if (options.concurrency > MAX_CONCURRENCY) {
    throw new PolicyError(
      'invalid_arguments',
      `--concurrency cannot exceed ${MAX_CONCURRENCY}`,
    );
  }
  if (options.maxBytes > HARD_MAX_BYTES) {
    throw new PolicyError(
      'invalid_arguments',
      `--max-bytes cannot exceed ${HARD_MAX_BYTES}`,
    );
  }
  return options;
}

export function validateReviewedManifestEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new PolicyError(
      'invalid_manifest',
      'Manifest entry must be an object',
    );
  }
  const externalId =
    typeof entry.external_id === 'string'
      ? entry.external_id.trim().toLowerCase()
      : '';
  if (!/^(node|way|relation)\/[1-9][0-9]*$/u.test(externalId)) {
    throw new PolicyError(
      'invalid_manifest',
      'external_id must be a stable OSM node/way/relation identifier',
    );
  }

  const wikidataId = normalizeWikidataId(entry.wikidata_id);
  const commonsFile = normalizeCommonsFileRef(entry.commons_file);
  const approvedBy =
    typeof entry.approved_by === 'string' ? entry.approved_by.trim() : '';
  const note = typeof entry.note === 'string' ? entry.note.trim() : '';
  const approvedAt = new Date(entry.approved_at);
  let evidenceUrl;
  try {
    evidenceUrl = new URL(entry.evidence_url);
  } catch {
    evidenceUrl = null;
  }

  if (!wikidataId || !commonsFile) {
    throw new PolicyError(
      'invalid_manifest',
      'wikidata_id and commons_file must be exact structured identifiers',
    );
  }
  if (entry.physical_poi_verified !== true) {
    throw new PolicyError(
      'invalid_manifest',
      'physical_poi_verified must explicitly be true',
    );
  }
  if (!approvedBy || approvedBy.length > 200) {
    throw new PolicyError(
      'invalid_manifest',
      'approved_by is required and must be at most 200 characters',
    );
  }
  if (
    Number.isNaN(approvedAt.getTime()) ||
    approvedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    throw new PolicyError(
      'invalid_manifest',
      'approved_at must be a valid past date',
    );
  }
  if (
    !evidenceUrl ||
    evidenceUrl.protocol !== 'https:' ||
    evidenceUrl.username ||
    evidenceUrl.password
  ) {
    throw new PolicyError(
      'invalid_manifest',
      'evidence_url must be an HTTPS URL without credentials',
    );
  }
  if (note.length < 10 || note.length > 1_000) {
    throw new PolicyError(
      'invalid_manifest',
      'note must explain the POI match in 10-1000 characters',
    );
  }

  return {
    externalId,
    wikidataId,
    commonsFile,
    approvedBy,
    approvedAt: approvedAt.toISOString(),
    evidenceUrl: evidenceUrl.toString(),
    note,
  };
}

export function validateCuratedManifestEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'Curated manifest entry must be an object',
    );
  }
  const slug = typeof entry.slug === 'string' ? entry.slug.trim() : '';
  const commonsFile = normalizeCommonsFileRef(entry.commons_file);
  const curatedBy =
    typeof entry.curated_by === 'string' ? entry.curated_by.trim() : '';
  const note = typeof entry.note === 'string' ? entry.note.trim() : '';
  const curatedAt = new Date(entry.curated_at);
  const evidenceFile = normalizeCommonsFileUrl(entry.evidence_url);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) || slug.length > 240) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'slug must be one canonical lowercase content slug',
    );
  }
  if (!commonsFile || evidenceFile !== commonsFile) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'commons_file and evidence_url must identify the same exact Commons File',
    );
  }
  if (entry.context_only !== true) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'context_only must explicitly be true',
    );
  }
  if (!curatedBy || curatedBy.length > 200) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'curated_by is required and must be at most 200 characters',
    );
  }
  if (
    Number.isNaN(curatedAt.getTime()) ||
    curatedAt.getTime() > Date.now() + 5 * 60 * 1000
  ) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'curated_at must be a valid past date',
    );
  }
  if (note.length < 10 || note.length > 1_000) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'note must explain the contextual match in 10-1000 characters',
    );
  }

  return {
    slug,
    commonsFile,
    curatedBy,
    curatedAt: curatedAt.toISOString(),
    evidenceUrl: `https://commons.wikimedia.org/wiki/${commonsFile.replaceAll(
      ' ',
      '_',
    )}`,
    note,
    contextOnly: true,
  };
}

function parsePositiveInteger(value, flag) {
  if (!/^[1-9][0-9]*$/u.test(String(value))) {
    throw new PolicyError(
      'invalid_arguments',
      `${flag} must be a positive integer`,
    );
  }
  return Number(value);
}

function normalizeMime(value) {
  const mime = String(value || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  return mime === 'image/jpg' ? 'image/jpeg' : mime;
}

function stripMarkup(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&#(\d{1,7});/gu, (_, code) => {
      const point = Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '';
    })
    .replace(/\s+/gu, ' ')
    .trim();
}

function metadataValue(extmetadata, key) {
  const value = extmetadata?.[key]?.value;
  return typeof value === 'string' ? value : '';
}

async function readBodyLimited(response, maxBytes) {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > maxBytes) {
    throw new PolicyError(
      'media_too_large',
      `Remote response exceeds the ${maxBytes}-byte limit`,
    );
  }
  if (!response.body) {
    throw new PolicyError('empty_response', 'Remote response has no body');
  }

  const chunks = [];
  let total = 0;
  const reader = response.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new PolicyError(
          'media_too_large',
          `Remote response exceeds the ${maxBytes}-byte limit`,
        );
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (total === 0) {
    throw new PolicyError('empty_response', 'Remote response is empty');
  }
  return Buffer.concat(chunks, total);
}

async function fetchApproved(url, kind, maxBytes, attempt = 0) {
  let current = validateRemoteUrl(url, kind);
  let redirects = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          Accept:
            kind === 'media'
              ? 'image/jpeg,image/png,image/webp'
              : 'application/json',
          'User-Agent': USER_AGENT,
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < 2) {
        await delay(300 * 2 ** attempt);
        return fetchApproved(url, kind, maxBytes, attempt + 1);
      }
      throw new Error(
        `Approved Wikimedia request failed: ${
          error instanceof Error ? error.message : 'network error'
        }`,
      );
    }
    try {
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= 4) {
          await response.body?.cancel();
          throw new PolicyError(
            'too_many_redirects',
            'Too many remote redirects',
          );
        }
        const location = response.headers.get('location');
        await response.body?.cancel();
        if (!location) {
          throw new PolicyError(
            'unsafe_redirect',
            'Redirect has no Location header',
          );
        }
        current = validateRemoteUrl(
          new URL(location, current).toString(),
          kind,
        );
        redirects += 1;
        continue;
      }

      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel();
        const retryAfter = Number(response.headers.get('retry-after') || 0);
        await delay(
          retryAfter > 0 && retryAfter <= 5
            ? retryAfter * 1_000
            : 500 * 2 ** attempt,
        );
        return fetchApproved(url, kind, maxBytes, attempt + 1);
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new PolicyError(
          'remote_http_error',
          `Approved Wikimedia host returned HTTP ${response.status}`,
        );
      }
      const body = await readBodyLimited(response, maxBytes);
      return { body, response, finalUrl: current.toString() };
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function fetchJson(url) {
  const { body } = await fetchApproved(url, 'api', JSON_MAX_BYTES);
  try {
    return JSON.parse(body.toString('utf8'));
  } catch {
    throw new PolicyError(
      'invalid_json',
      'Wikimedia API returned invalid JSON',
    );
  }
}

async function fetchWikidataP18(wikidataId) {
  const id = normalizeWikidataId(wikidataId);
  if (!id) {
    throw new PolicyError('invalid_wikidata_id', 'Invalid Wikidata identifier');
  }
  const apiUrl = new URL('https://www.wikidata.org/w/api.php');
  apiUrl.search = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    formatversion: '2',
    ids: id,
    props: 'claims',
  }).toString();
  const data = await fetchJson(apiUrl);
  const entity = data?.entities?.[id];
  if (!entity || entity.missing) {
    throw new PolicyError('wikidata_missing', `${id} does not exist`);
  }
  const claims = Array.isArray(entity?.claims?.P18)
    ? entity.claims.P18.filter(claim => claim?.rank !== 'deprecated')
    : [];
  claims.sort(
    (a, b) => Number(b?.rank === 'preferred') - Number(a?.rank === 'preferred'),
  );
  for (const claim of claims) {
    const filename = claim?.mainsnak?.datavalue?.value;
    const normalized = normalizeCommonsFileRef(
      typeof filename === 'string' ? `File:${filename}` : '',
    );
    if (normalized) return normalized;
  }
  return null;
}

async function fetchCommonsMetadata(requestedFile, maxBytes) {
  const file = normalizeCommonsFileRef(requestedFile);
  if (!file) {
    throw new PolicyError(
      'invalid_commons_file',
      'Wikimedia Commons value must be an exact File: reference',
    );
  }
  const apiUrl = new URL('https://commons.wikimedia.org/w/api.php');
  apiUrl.search = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|sha1|timestamp|extmetadata',
    iiurlwidth: '1600',
    redirects: '1',
    titles: file,
  }).toString();
  const data = await fetchJson(apiUrl);
  const page = Array.isArray(data?.query?.pages) ? data.query.pages[0] : null;
  const image = Array.isArray(page?.imageinfo) ? page.imageinfo[0] : null;
  if (!page || page.missing || !image) {
    throw new PolicyError('commons_file_missing', `${file} was not found`);
  }

  const canonicalTitle = normalizeCommonsFileRef(page.title);
  const mime = normalizeMime(image.mime);
  const byteSize = Number(image.size || 0);
  const width = Number(image.width || 0);
  const height = Number(image.height || 0);
  if (!canonicalTitle) {
    throw new PolicyError(
      'invalid_commons_file',
      'Commons returned a non-file result',
    );
  }
  if (!MIME_TO_EXTENSION.has(mime)) {
    throw new PolicyError(
      'unsupported_mime',
      `Commons source MIME ${mime || 'unknown'} is not allowed`,
    );
  }
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0) {
    throw new PolicyError(
      'invalid_source_size',
      'Commons source size is invalid',
    );
  }
  if (!image.thumburl && byteSize > maxBytes) {
    throw new PolicyError(
      'media_too_large',
      `Commons download exceeds the ${maxBytes}-byte limit`,
    );
  }
  if (
    !Number.isSafeInteger(width) ||
    !Number.isSafeInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new PolicyError(
      'invalid_dimensions',
      'Commons dimensions are invalid',
    );
  }

  const license = classifyCommonsLicense(
    metadataValue(image.extmetadata, 'LicenseShortName'),
  );
  if (!license) {
    throw new PolicyError(
      'license_not_allowed',
      'Commons license is unknown, noncommercial, no-derivatives, or unsupported',
    );
  }

  const artist = stripMarkup(metadataValue(image.extmetadata, 'Artist')).slice(
    0,
    1_000,
  );
  const credit = stripMarkup(metadataValue(image.extmetadata, 'Credit')).slice(
    0,
    1_000,
  );
  if (license.attributionRequired && !artist && !credit) {
    throw new PolicyError(
      'missing_attribution',
      'Attribution-required media has no author or credit metadata',
    );
  }

  const originalUrl = validateRemoteUrl(image.url, 'media').toString();
  const downloadUrl = validateRemoteUrl(
    image.thumburl || image.url,
    'media',
  ).toString();
  const downloadedWidth = Number(image.thumbwidth || width);
  const downloadedHeight = Number(image.thumbheight || height);
  if (
    !Number.isSafeInteger(downloadedWidth) ||
    !Number.isSafeInteger(downloadedHeight) ||
    downloadedWidth <= 0 ||
    downloadedHeight <= 0
  ) {
    throw new PolicyError(
      'invalid_dimensions',
      'Commons download dimensions are invalid',
    );
  }
  const encodedTitle = encodeURIComponent(canonicalTitle).replace('%3A', ':');
  return {
    requestedFile: file,
    canonicalTitle,
    sourcePageUrl: `https://commons.wikimedia.org/wiki/${encodedTitle}`,
    originalUrl,
    downloadUrl,
    author: artist || credit || 'Unknown author; see Wikimedia Commons source',
    credit,
    license,
    mime,
    byteSize,
    width: downloadedWidth,
    height: downloadedHeight,
    originalWidth: width,
    originalHeight: height,
    commonsSha1:
      typeof image.sha1 === 'string' && /^[0-9a-f]{40}$/iu.test(image.sha1)
        ? image.sha1.toLowerCase()
        : null,
    commonsTimestamp:
      typeof image.timestamp === 'string' ? image.timestamp : null,
    usageTerms: stripMarkup(
      metadataValue(image.extmetadata, 'UsageTerms'),
    ).slice(0, 500),
    attributionRequired:
      metadataValue(image.extmetadata, 'AttributionRequired') || null,
  };
}

async function downloadAndValidateMedia(media, maxBytes) {
  const { body, response, finalUrl } = await fetchApproved(
    media.downloadUrl,
    'media',
    maxBytes,
  );
  const headerMime = normalizeMime(response.headers.get('content-type'));
  const detectedMime = detectRasterMime(body);
  if (
    !detectedMime ||
    headerMime !== detectedMime ||
    media.mime !== detectedMime
  ) {
    throw new PolicyError(
      'mime_mismatch',
      'Commons metadata, HTTP Content-Type, and file signature do not match',
    );
  }
  const sha256 = createHash('sha256').update(body).digest('hex');
  return {
    bytes: body,
    mime: detectedMime,
    sha256,
    objectKey: buildObjectKey(sha256, detectedMime),
    downloadedUrl: finalUrl,
  };
}

async function loadReviewedManifest(filename) {
  if (!filename) return new Map();
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path.resolve(filename), 'utf8'));
  } catch (error) {
    throw new PolicyError(
      'invalid_manifest',
      `Cannot read reviewed manifest: ${
        error instanceof Error ? error.message : 'invalid JSON'
      }`,
    );
  }
  if (!parsed || parsed.version !== 2 || !Array.isArray(parsed.entries)) {
    throw new PolicyError(
      'invalid_manifest',
      'Reviewed manifest must have version 2 and an entries array',
    );
  }
  const result = new Map();
  parsed.entries.forEach((rawEntry, index) => {
    let entry;
    try {
      entry = validateReviewedManifestEntry(rawEntry);
    } catch (error) {
      throw new PolicyError(
        'invalid_manifest',
        `Manifest entry ${index + 1}: ${
          error instanceof Error ? error.message : 'invalid'
        }`,
      );
    }
    if (result.has(entry.externalId)) {
      throw new PolicyError(
        'invalid_manifest',
        `Manifest contains duplicate external_id ${entry.externalId}`,
      );
    }
    result.set(entry.externalId, entry);
  });
  return result;
}

async function loadCuratedManifest(filename) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path.resolve(filename), 'utf8'));
  } catch (error) {
    throw new PolicyError(
      'invalid_curated_manifest',
      `Cannot read curated manifest: ${
        error instanceof Error ? error.message : 'invalid JSON'
      }`,
    );
  }
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.entries)) {
    throw new PolicyError(
      'invalid_curated_manifest',
      'Curated manifest must have version 1 and an entries array',
    );
  }
  const result = new Map();
  parsed.entries.forEach((rawEntry, index) => {
    let entry;
    try {
      entry = validateCuratedManifestEntry(rawEntry);
    } catch (error) {
      throw new PolicyError(
        'invalid_curated_manifest',
        `Curated manifest entry ${index + 1}: ${
          error instanceof Error ? error.message : 'invalid'
        }`,
      );
    }
    if (result.has(entry.slug)) {
      throw new PolicyError(
        'invalid_curated_manifest',
        `Curated manifest contains duplicate slug ${entry.slug}`,
      );
    }
    result.set(entry.slug, entry);
  });
  return result;
}

function createAuditWriter(filename) {
  if (!filename) {
    return { write() {}, async close() {} };
  }
  const stream = createWriteStream(path.resolve(filename), {
    encoding: 'utf8',
    flags: 'w',
  });
  let failed = null;
  stream.on('error', error => {
    failed = error;
  });
  return {
    write(record) {
      if (failed) throw failed;
      stream.write(`${JSON.stringify(record)}\n`);
    },
    close() {
      return new Promise((resolveClose, rejectClose) => {
        if (failed) {
          rejectClose(failed);
          return;
        }
        stream.end(error => (error ? rejectClose(error) : resolveClose()));
      });
    },
  };
}

function databaseUrlFromEnvironment() {
  return (
    process.env.PUBLIC_REFERENCE_DATABASE_URL ||
    process.env.SUPER_APP_POSTGRES_URL ||
    process.env.DATABASE_URL ||
    ''
  );
}

function createMinioTarget() {
  const endpoint = process.env.MINIO_ENDPOINT || '';
  const accessKey =
    process.env.MINIO_ACCESS_KEY || process.env.MINIO_USER || '';
  const secretKey =
    process.env.MINIO_SECRET_KEY || process.env.MINIO_PASS || '';
  const bucket = process.env.MINIO_BUCKET || 'laju-chat';
  if (!endpoint || !accessKey || !secretKey) {
    throw new PolicyError(
      'minio_not_configured',
      'MINIO_ENDPOINT and MinIO credentials are required with --apply',
    );
  }
  if (
    bucket.length < 3 ||
    bucket.length > 63 ||
    !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/u.test(bucket)
  ) {
    throw new PolicyError('invalid_bucket', 'MINIO_BUCKET is invalid');
  }
  return {
    bucket,
    client: new S3Client({
      endpoint,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    }),
  };
}

export function buildPublicUrl(bucket, objectKey) {
  return `/api/content/media/${encodeURIComponent(bucket)}/${objectKey
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
}

async function assertMinioBucket(target) {
  await target.client.send(new HeadBucketCommand({ Bucket: target.bucket }));
}

async function putObjectIdempotently(target, media, commons) {
  let exists = false;
  try {
    const head = await target.client.send(
      new HeadObjectCommand({
        Bucket: target.bucket,
        Key: media.objectKey,
      }),
    );
    exists =
      Number(head.ContentLength || 0) === media.bytes.byteLength &&
      head.Metadata?.sha256?.toLowerCase() === media.sha256 &&
      normalizeMime(head.ContentType) === media.mime;
  } catch (error) {
    const status = error?.$metadata?.httpStatusCode;
    if (
      status !== 404 &&
      error?.name !== 'NotFound' &&
      error?.name !== 'NoSuchKey'
    ) {
      throw error;
    }
  }

  if (!exists) {
    await target.client.send(
      new PutObjectCommand({
        Bucket: target.bucket,
        Key: media.objectKey,
        Body: media.bytes,
        ContentType: media.mime,
        ContentLength: media.bytes.byteLength,
        CacheControl: 'public, max-age=31536000, immutable',
        ContentDisposition: 'inline',
        Metadata: {
          sha256: media.sha256,
          provider: 'wikimedia-commons',
          license: commons.license.key,
        },
      }),
    );
  }
  return { reused: exists };
}

export async function assertProvenanceSchema(pool) {
  const result = await pool.query(`
    SELECT
      to_regclass('public.public_media_assets') IS NOT NULL AS assets_ready,
      to_regclass('public.public_media_asset_links') IS NOT NULL AS links_ready,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = to_regclass('public.public_media_asset_links')
          AND conname = 'public_media_asset_links_match_method_check'
          AND pg_get_constraintdef(oid)
            LIKE '%curated_wikimedia_commons_file%'
      ) AS curated_links_ready,
      EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = to_regclass('public.public_media_asset_links')
          AND conname = 'public_media_asset_links_curated_scope_check'
      ) AS curated_scope_ready
  `);
  if (
    !result.rows[0]?.assets_ready ||
    !result.rows[0]?.links_ready ||
    !result.rows[0]?.curated_links_ready ||
    !result.rows[0]?.curated_scope_ready
  ) {
    throw new PolicyError(
      'migration_required',
      'Apply marketplace migrations 20260730150000, 20260730152000, and 20260730154000 before using --apply',
    );
  }
}

async function loadReferenceRows(pool, options) {
  const result = await pool.query(
    `
      SELECT
        id::text,
        slug,
        title,
        cover_image,
        metadata->>'external_id' AS external_id,
        metadata->>'source_url' AS source_url,
        metadata->>'source_dataset' AS source_dataset,
        metadata->>'record_kind' AS record_kind,
        metadata->>'wikimedia_commons' AS wikimedia_commons,
        metadata->>'wikidata' AS wikidata,
        metadata->'image_credit'->>'source_url' AS curated_commons_url,
        metadata->>'media_storage' AS media_storage
      FROM content_items
      WHERE content_status = 'active'
        AND (
          (
            metadata->>'record_kind' = 'real_openstreetmap_reference'
            AND metadata->>'source_dataset' = 'openstreetmap'
            AND (
              NULLIF(BTRIM(metadata->>'wikimedia_commons'), '') IS NOT NULL
              OR NULLIF(BTRIM(metadata->>'wikidata'), '') IS NOT NULL
            )
          )
          OR (
            metadata->>'record_kind' = 'real_open_data_reference'
            AND metadata->'image_credit'->>'provider' = 'Wikimedia Commons'
            AND metadata->'image_credit'->>'source_url'
              LIKE 'https://commons.wikimedia.org/wiki/File:%'
          )
        )
        AND (
          $2::boolean
          OR COALESCE(metadata->>'media_storage', '') <> 'minio'
        )
      ORDER BY
        CASE
          WHEN metadata->>'wikimedia_commons' ILIKE 'File:%' THEN 0
          WHEN metadata->>'record_kind' = 'real_open_data_reference' THEN 1
          WHEN NULLIF(BTRIM(metadata->>'wikidata'), '') IS NOT NULL THEN 2
          ELSE 3
        END,
        id
      LIMIT $1
    `,
    [options.limit, options.reverify],
  );
  return result.rows;
}

async function saveAppliedMedia(
  pool,
  row,
  commons,
  media,
  target,
  mapping,
  matchMethod,
  curatedMapping,
) {
  const now = new Date().toISOString();
  const method = matchMethod;
  const reviewStatus = mapping ? 'human_approved' : 'source_exact';
  const isPlaceSpecific = method !== 'curated_wikimedia_commons_file';
  const publicUrl = buildPublicUrl(target.bucket, media.objectKey);
  const credit = {
    provider: 'Wikimedia Commons',
    title: commons.canonicalTitle,
    author: commons.author,
    credit: commons.credit || undefined,
    license: commons.license.name,
    license_key: commons.license.key,
    license_url: commons.license.url,
    source_url: commons.sourcePageUrl,
    original_url: commons.originalUrl,
    original_byte_size: commons.byteSize,
    original_width: commons.originalWidth,
    original_height: commons.originalHeight,
    downloaded_url: media.downloadedUrl,
    retrieved_at: now,
  };
  const provenance = {
    importer: 'enrich-public-reference-media-v1',
    record_kind: row.record_kind,
    content_slug: row.slug,
    source_dataset: row.source_dataset || 'curated_public_reference',
    osm_external_id: row.external_id,
    osm_source_url: row.source_url,
    source_field: mapping
      ? 'wikidata:P18'
      : method === 'curated_wikimedia_commons_file'
        ? 'image_credit.source_url'
        : 'wikimedia_commons',
    requested_commons_file: commons.requestedFile,
    canonical_commons_file: commons.canonicalTitle,
    curated_input_url: curatedMapping ? row.curated_commons_url : undefined,
    curated_manifest: curatedMapping
      ? {
          curated_by: curatedMapping.curatedBy,
          curated_at: curatedMapping.curatedAt,
          evidence_url: curatedMapping.evidenceUrl,
          note: curatedMapping.note,
          context_only: true,
        }
      : undefined,
    wikidata_id: mapping?.wikidataId || undefined,
    manifest_review: mapping
      ? {
          approved_by: mapping.approvedBy,
          approved_at: mapping.approvedAt,
          evidence_url: mapping.evidenceUrl,
          note: mapping.note,
          physical_poi_verified: true,
        }
      : undefined,
  };
  const sourceMetadata = {
    requested_file: commons.requestedFile,
    commons_sha1: commons.commonsSha1,
    commons_timestamp: commons.commonsTimestamp,
    usage_terms: commons.usageTerms || undefined,
    attribution_required: commons.attributionRequired,
    verified_at: now,
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const locked = await client.query(
      `
        SELECT
          id,
          slug,
          metadata->>'source_dataset' AS source_dataset,
          metadata->>'source_url' AS source_url,
          metadata->>'external_id' AS external_id,
          metadata->>'record_kind' AS record_kind,
          metadata->>'is_transactional' AS is_transactional,
          metadata->>'wikimedia_commons' AS wikimedia_commons,
          metadata->>'wikidata' AS wikidata,
          metadata->'image_credit'->>'source_url' AS curated_commons_url,
          metadata->'image_credit'->>'provider' AS curated_provider
        FROM content_items
        WHERE id = $1::uuid
          AND content_status = 'active'
          AND metadata->>'record_kind' IN (
            'real_openstreetmap_reference',
            'real_open_data_reference'
          )
        FOR UPDATE
      `,
      [row.id],
    );
    if (locked.rowCount !== 1) {
      throw new Error('Content reference changed before media could be linked');
    }
    const lockedRow = locked.rows[0];
    const sourceStillMatches = mapping
      ? normalizeWikidataId(lockedRow.wikidata) === mapping.wikidataId
      : method === 'curated_wikimedia_commons_file'
        ? normalizeCommonsFileUrl(lockedRow.curated_commons_url) ===
          commons.requestedFile
        : normalizeCommonsFileRef(lockedRow.wikimedia_commons) ===
          commons.requestedFile;
    const recordStillEligible =
      method === 'curated_wikimedia_commons_file'
        ? lockedRow.record_kind === 'real_open_data_reference' &&
          lockedRow.slug === row.slug &&
          lockedRow.curated_provider === 'Wikimedia Commons' &&
          lockedRow.is_transactional === 'false'
        : lockedRow.record_kind === 'real_openstreetmap_reference' &&
          lockedRow.source_dataset === 'openstreetmap' &&
          lockedRow.is_transactional === 'false';
    if (
      lockedRow.external_id !== row.external_id ||
      lockedRow.source_url !== row.source_url ||
      !sourceStillMatches ||
      !recordStillEligible
    ) {
      throw new Error(
        'Structured media source changed before media could be linked',
      );
    }

    const assetResult = await client.query(
      `
        INSERT INTO public_media_assets (
          provider,
          provider_asset_id,
          canonical_title,
          source_page_url,
          original_url,
          downloaded_url,
          author_text,
          license_key,
          license_name,
          license_url,
          mime_type,
          byte_size,
          width,
          height,
          sha256,
          object_bucket,
          object_key,
          public_url,
          source_metadata,
          first_imported_at,
          last_verified_at
        )
        VALUES (
          'wikimedia_commons',
          $1, $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb,
          now(), now()
        )
        ON CONFLICT (provider, provider_asset_id, sha256) DO UPDATE
        SET canonical_title = EXCLUDED.canonical_title,
            source_page_url = EXCLUDED.source_page_url,
            original_url = EXCLUDED.original_url,
            downloaded_url = EXCLUDED.downloaded_url,
            author_text = EXCLUDED.author_text,
            license_key = EXCLUDED.license_key,
            license_name = EXCLUDED.license_name,
            license_url = EXCLUDED.license_url,
            mime_type = EXCLUDED.mime_type,
            byte_size = EXCLUDED.byte_size,
            width = EXCLUDED.width,
            height = EXCLUDED.height,
            object_bucket = EXCLUDED.object_bucket,
            object_key = EXCLUDED.object_key,
            public_url = EXCLUDED.public_url,
            source_metadata = public_media_assets.source_metadata
              || EXCLUDED.source_metadata,
            last_verified_at = now()
        RETURNING id::text
      `,
      [
        commons.canonicalTitle,
        commons.sourcePageUrl,
        commons.originalUrl,
        media.downloadedUrl,
        commons.author,
        commons.license.key,
        commons.license.name,
        commons.license.url,
        media.mime,
        media.bytes.byteLength,
        commons.width,
        commons.height,
        media.sha256,
        target.bucket,
        media.objectKey,
        publicUrl,
        JSON.stringify(sourceMetadata),
      ],
    );
    const assetId = assetResult.rows[0].id;

    await client.query(
      `
        UPDATE public_media_asset_links
        SET is_active = false,
            updated_at = now()
        WHERE content_id = $1::uuid
          AND usage = 'cover'
          AND is_active
      `,
      [row.id],
    );

    await client.query(
      `
        INSERT INTO public_media_asset_links (
          content_id,
          asset_id,
          usage,
          match_method,
          match_confidence,
          is_place_specific,
          review_status,
          reviewed_by,
          reviewed_at,
          review_evidence_url,
          provenance,
          is_active,
          created_at,
          updated_at
        )
        VALUES (
          $1::uuid, $2::uuid, 'cover', $3, 1.000, $9::boolean, $4,
          $5, $6::timestamptz, $7, $8::jsonb, true, now(), now()
        )
        ON CONFLICT (content_id, asset_id, usage, match_method) DO UPDATE
        SET match_confidence = EXCLUDED.match_confidence,
            is_place_specific = EXCLUDED.is_place_specific,
            review_status = EXCLUDED.review_status,
            reviewed_by = EXCLUDED.reviewed_by,
            reviewed_at = EXCLUDED.reviewed_at,
            review_evidence_url = EXCLUDED.review_evidence_url,
            provenance = public_media_asset_links.provenance
              || EXCLUDED.provenance,
            is_active = true,
            updated_at = now()
      `,
      [
        row.id,
        assetId,
        method,
        reviewStatus,
        mapping?.approvedBy || null,
        mapping?.approvedAt || null,
        mapping?.evidenceUrl || null,
        JSON.stringify(provenance),
        isPlaceSpecific,
      ],
    );

    const metadataMirror = {
      cover_image: publicUrl,
      image_url: publicUrl,
      image_urls: [publicUrl],
      gallery_images: [publicUrl],
      media_storage: 'minio',
      media_kind:
        method === 'curated_wikimedia_commons_file'
          ? 'licensed_reference_media'
          : 'licensed_source_photo',
      media_is_place_specific: isPlaceSpecific,
      media_asset_id: assetId,
      media_sha256: media.sha256,
      media_object_bucket: target.bucket,
      media_object_key: media.objectKey,
      media_match_method: method,
      media_match_confidence: 1,
      media_downloaded_at: now,
      media_license_key: commons.license.key,
      image_credit: credit,
      media_provenance: provenance,
    };
    const update = await client.query(
      `
        UPDATE content_items
        SET cover_image = $2,
            metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb,
            updated_at = now()
        WHERE id = $1::uuid
          AND content_status = 'active'
          AND metadata->>'record_kind' IN (
            'real_openstreetmap_reference',
            'real_open_data_reference'
          )
      `,
      [row.id, publicUrl, JSON.stringify(metadataMirror)],
    );
    if (update.rowCount !== 1) {
      throw new Error('Content reference was not updated');
    }

    await client.query('COMMIT');
    return { assetId, publicUrl, method };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function inspectP18Candidate(row, mapping, options) {
  const wikidataId = normalizeWikidataId(row.wikidata);
  if (!wikidataId) {
    throw new PolicyError(
      'invalid_wikidata_id',
      'OSM wikidata value is not one exact Q identifier',
    );
  }
  const p18File = await fetchWikidataP18(wikidataId);
  if (!p18File) {
    return {
      terminal: true,
      audit: {
        status: 'review_candidate_no_p18',
        wikidata_id: wikidataId,
      },
    };
  }

  const commons = await fetchCommonsMetadata(p18File, options.maxBytes);
  if (!mapping) {
    return {
      terminal: true,
      audit: {
        status: 'review_required_wikidata_p18',
        wikidata_id: wikidataId,
        commons_file: commons.canonicalTitle,
        source_page_url: commons.sourcePageUrl,
        license: commons.license.name,
        license_url: commons.license.url,
        note: 'P18 is not auto-published because it may depict a headquarters, logo, or another branch.',
      },
    };
  }

  if (
    mapping.wikidataId !== wikidataId ||
    mapping.commonsFile.toLocaleLowerCase('en-US') !==
      p18File.toLocaleLowerCase('en-US')
  ) {
    throw new PolicyError(
      'manifest_mismatch',
      'Reviewed manifest does not match the current OSM Wikidata ID and P18 file',
    );
  }
  return { terminal: false, commons, mapping };
}

async function processReference(
  row,
  options,
  reviewedMappings,
  usedMappings,
  curatedMappings,
  usedCuratedMappings,
  pool,
  minio,
) {
  const baseAudit = {
    content_id: row.id,
    external_id: row.external_id,
    title: row.title,
    dry_run: !options.apply,
  };
  const directFile = normalizeCommonsFileRef(row.wikimedia_commons);
  const curatedFile =
    row.record_kind === 'real_open_data_reference'
      ? normalizeCommonsFileUrl(row.curated_commons_url)
      : null;
  const mapping = reviewedMappings.get(row.external_id?.toLowerCase()) || null;
  const curatedMapping = curatedMappings.get(row.slug) || null;

  let commons;
  let approvedMapping = null;
  let matchMethod;
  if (directFile) {
    commons = await fetchCommonsMetadata(directFile, options.maxBytes);
    matchMethod = 'osm_wikimedia_commons_file';
  } else if (curatedFile) {
    if (!curatedMapping || curatedMapping.commonsFile !== curatedFile) {
      return {
        ...baseAudit,
        status: 'review_required_curated_commons_file',
        commons_file: curatedFile,
        note: 'The curated reference is not present with the same slug and exact file in the versioned contextual-media manifest.',
      };
    }
    commons = await fetchCommonsMetadata(curatedFile, options.maxBytes);
    matchMethod = 'curated_wikimedia_commons_file';
    usedCuratedMappings.add(row.slug);
  } else if (row.wikidata) {
    const inspected = await inspectP18Candidate(row, mapping, options);
    if (inspected.terminal) {
      return { ...baseAudit, ...inspected.audit };
    }
    commons = inspected.commons;
    approvedMapping = inspected.mapping;
    matchMethod = 'reviewed_wikidata_p18';
    usedMappings.add(row.external_id.toLowerCase());
  } else if (isCommonsCategoryRef(row.wikimedia_commons)) {
    return {
      ...baseAudit,
      status: 'review_required_commons_category',
      commons_category: row.wikimedia_commons.trim(),
      note: 'Commons categories are collections, not an exact approved photo mapping.',
    };
  } else {
    return {
      ...baseAudit,
      status: 'rejected_invalid_structured_source',
      note: 'No exact OSM Commons File or Wikidata Q identifier is available.',
    };
  }

  const downloaded = await downloadAndValidateMedia(commons, options.maxBytes);
  const planned = {
    ...baseAudit,
    status: options.apply ? 'pending_apply' : 'would_apply',
    match_method: approvedMapping ? 'reviewed_wikidata_p18' : matchMethod,
    commons_file: commons.canonicalTitle,
    source_page_url: commons.sourcePageUrl,
    license: commons.license.name,
    license_url: commons.license.url,
    author: commons.author,
    mime: downloaded.mime,
    byte_size: downloaded.bytes.byteLength,
    sha256: downloaded.sha256,
    object_key: downloaded.objectKey,
  };
  if (!options.apply) return planned;

  const object = await putObjectIdempotently(minio, downloaded, commons);
  const saved = await saveAppliedMedia(
    pool,
    row,
    commons,
    downloaded,
    minio,
    approvedMapping,
    matchMethod,
    curatedMapping,
  );
  return {
    ...planned,
    status: 'applied',
    minio_reused: object.reused,
    asset_id: saved.assetId,
    public_url: saved.publicUrl,
  };
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length);
  let nextIndex = 0;
  const run = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => run()),
  );
  return results;
}

function summarize(records) {
  const byStatus = {};
  records.forEach(record => {
    byStatus[record.status] = (byStatus[record.status] || 0) + 1;
  });
  return {
    scanned: records.length,
    by_status: Object.fromEntries(
      Object.entries(byStatus).sort(([left], [right]) =>
        left.localeCompare(right),
      ),
    ),
  };
}

function safeErrorMessage(error) {
  if (error instanceof PolicyError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'unexpected_error',
    message: error instanceof Error ? error.message : 'Unexpected error',
  };
}

function delay(milliseconds) {
  return new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds));
}

function printHelp() {
  console.log(
    `
Usage:
  node scripts/enrich-public-reference-media.mjs [options]

Options:
  --apply                       Upload to MinIO and update the database.
  --limit <n>                   Max source rows (default ${DEFAULT_LIMIT}).
  --concurrency <n>             Concurrent Wikimedia work (default ${DEFAULT_CONCURRENCY}, max ${MAX_CONCURRENCY}).
  --max-bytes <n>               Per-file limit, never above ${HARD_MAX_BYTES}.
  --reviewed-manifest <file>    Human-approved Wikidata P18 mappings.
  --curated-manifest <file>     Versioned contextual Commons allowlist.
  --audit-file <file>           Write one JSON audit record per source row.
  --reverify                    Include rows already enriched in MinIO.
  --help                        Show this help.

Dry-run is the default. No Google Places, arbitrary website, name-search,
Commons Category, or unreviewed Wikidata P18 image is ever auto-published.
`.trim(),
  );
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseCliArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  const databaseUrl = databaseUrlFromEnvironment();
  if (!databaseUrl) {
    throw new PolicyError(
      'database_not_configured',
      'Set PUBLIC_REFERENCE_DATABASE_URL, SUPER_APP_POSTGRES_URL, or DATABASE_URL',
    );
  }

  const reviewedMappings = await loadReviewedManifest(options.reviewedManifest);
  const usedMappings = new Set();
  const curatedMappings = await loadCuratedManifest(options.curatedManifest);
  const usedCuratedMappings = new Set();
  const audit = createAuditWriter(options.auditFile);
  const pool = new Pool({
    connectionString: databaseUrl,
    max: options.concurrency + 2,
    application_name: 'lajukan_public_reference_media',
  });
  let minio = null;
  let records = [];

  try {
    if (options.apply) {
      await assertProvenanceSchema(pool);
      minio = createMinioTarget();
      await assertMinioBucket(minio);
    }
    const rows = await loadReferenceRows(pool, options);
    records = await mapWithConcurrency(
      rows,
      options.concurrency,
      async (row, index) => {
        let record;
        try {
          record = await processReference(
            row,
            options,
            reviewedMappings,
            usedMappings,
            curatedMappings,
            usedCuratedMappings,
            pool,
            minio,
          );
        } catch (error) {
          const safe = safeErrorMessage(error);
          record = {
            content_id: row.id,
            external_id: row.external_id,
            title: row.title,
            dry_run: !options.apply,
            status:
              error instanceof PolicyError
                ? `rejected_${error.code}`
                : 'failed',
            error: safe.message,
          };
        }
        audit.write(record);
        if ((index + 1) % 50 === 0 || index + 1 === rows.length) {
          console.error(`Inspected ${index + 1}/${rows.length} references`);
        }
        return record;
      },
    );

    const unusedReviewedMappings = [...reviewedMappings.keys()].filter(
      externalId => !usedMappings.has(externalId),
    );
    const unusedCuratedMappings = [...curatedMappings.keys()].filter(
      slug => !usedCuratedMappings.has(slug),
    );
    const summary = {
      mode: options.apply ? 'apply' : 'dry-run',
      source_policy: {
        auto_apply: [
          'osm_wikimedia_commons_file',
          'curated_wikimedia_commons_file',
        ],
        review_only: ['wikimedia_commons_category', 'wikidata_p18'],
        prohibited: [
          'google_places_download',
          'arbitrary_website_download',
          'business_name_image_search',
        ],
      },
      ...summarize(records),
      reviewed_manifest_entries: reviewedMappings.size,
      unused_reviewed_manifest_external_ids: unusedReviewedMappings,
      curated_manifest_entries: curatedMappings.size,
      unused_curated_manifest_slugs: unusedCuratedMappings,
      audit_file: options.auditFile ? path.resolve(options.auditFile) : null,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (records.some(record => record.status === 'failed')) {
      process.exitCode = 2;
    }
  } finally {
    await audit.close();
    await pool.end();
  }
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';
if (invokedPath === import.meta.url) {
  main().catch(error => {
    const safe = safeErrorMessage(error);
    console.error(`${safe.code}: ${safe.message}`);
    process.exitCode = 1;
  });
}
