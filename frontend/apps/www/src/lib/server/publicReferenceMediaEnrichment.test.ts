import { describe, expect, it, vi } from 'vitest';

import {
  assertProvenanceSchema,
  buildObjectKey,
  buildPublicUrl,
  classifyCommonsLicense,
  detectRasterMime,
  isCommonsCategoryRef,
  normalizeCommonsFileRef,
  normalizeCommonsFileUrl,
  normalizeWikidataId,
  parseCliArgs,
  validateCuratedManifestEntry,
  validateRemoteUrl,
  validateReviewedManifestEntry,
} from '../../../scripts/enrich-public-reference-media.mjs';

describe('public-reference media source policy', () => {
  it('accepts only exact Commons File references for automatic use', () => {
    expect(normalizeCommonsFileRef(' File:Pasar_Beringharjo.jpg ')).toBe(
      'File:Pasar Beringharjo.jpg',
    );
    expect(normalizeCommonsFileRef('Category:Markets in Indonesia')).toBeNull();
    expect(normalizeCommonsFileRef('https://example.com/photo.jpg')).toBeNull();
    expect(normalizeCommonsFileRef('File:unsafe.jpg#section')).toBeNull();
    expect(isCommonsCategoryRef('Category:Markets_in_Indonesia')).toBe(true);
  });

  it('accepts only exact HTTPS Commons File page URLs', () => {
    expect(
      normalizeCommonsFileUrl(
        'https://commons.wikimedia.org/wiki/File:Pasar_Beringharjo.jpg',
      ),
    ).toBe('File:Pasar Beringharjo.jpg');
    expect(
      normalizeCommonsFileUrl(
        'https://commons.wikimedia.org/wiki/File:Batik%20Pekalongan.jpg',
      ),
    ).toBe('File:Batik Pekalongan.jpg');

    expect(
      normalizeCommonsFileUrl(
        'https://commons.wikimedia.org/wiki/Category:Markets_in_Indonesia',
      ),
    ).toBeNull();
    expect(
      normalizeCommonsFileUrl(
        'https://commons.wikimedia.org/wiki/File:Pasar.jpg?download=1',
      ),
    ).toBeNull();
    expect(
      normalizeCommonsFileUrl(
        'https://upload.wikimedia.org/example/commons/photo.jpg',
      ),
    ).toBeNull();
    expect(
      normalizeCommonsFileUrl('https://example.com/wiki/File:Pasar.jpg'),
    ).toBeNull();
  });

  it('accepts one Wikidata entity identifier and rejects compound values', () => {
    expect(normalizeWikidataId(' q12345 ')).toBe('Q12345');
    expect(normalizeWikidataId('Q1;Q2')).toBeNull();
    expect(normalizeWikidataId('P18')).toBeNull();
    expect(normalizeWikidataId('Q0')).toBeNull();
  });

  it('uses an anchored reusable-license allowlist', () => {
    expect(classifyCommonsLicense('CC0 1.0')?.key).toBe('cc0-1.0');
    expect(classifyCommonsLicense('Public domain')?.key).toBe('public-domain');
    expect(classifyCommonsLicense('CC BY 4.0')?.key).toBe('cc-by-4.0');
    expect(classifyCommonsLicense('CC BY-SA 3.0')?.key).toBe('cc-by-sa-3.0');

    expect(classifyCommonsLicense('CC BY-NC 4.0')).toBeNull();
    expect(classifyCommonsLicense('CC BY-ND 4.0')).toBeNull();
    expect(classifyCommonsLicense('CC BY-SA 4.0 or fair use')).toBeNull();
    expect(classifyCommonsLicense('Unknown')).toBeNull();
  });

  it('allows only HTTPS Wikimedia API and upload hosts', () => {
    expect(
      validateRemoteUrl('https://commons.wikimedia.org/w/api.php', 'api')
        .hostname,
    ).toBe('commons.wikimedia.org');
    expect(
      validateRemoteUrl('https://upload.wikimedia.org/example.jpg', 'media')
        .hostname,
    ).toBe('upload.wikimedia.org');

    expect(() =>
      validateRemoteUrl('http://upload.wikimedia.org/example.jpg', 'media'),
    ).toThrow(/approved Wikimedia hosts/u);
    expect(() =>
      validateRemoteUrl('https://example.com/example.jpg', 'media'),
    ).toThrow(/approved Wikimedia hosts/u);
    expect(() =>
      validateRemoteUrl(
        'https://user:secret@upload.wikimedia.org/example.jpg',
        'media',
      ),
    ).toThrow(/approved Wikimedia hosts/u);
  });
});

describe('public-reference media file policy', () => {
  it('recognizes only JPEG, PNG, and WebP signatures', () => {
    expect(detectRasterMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      'image/jpeg',
    );
    expect(
      detectRasterMime(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe('image/png');
    expect(detectRasterMime(Buffer.from('RIFF0000WEBPpayload', 'ascii'))).toBe(
      'image/webp',
    );
    expect(detectRasterMime(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('builds deterministic content-addressed MinIO keys', () => {
    const hash = 'ab'.repeat(32);
    expect(buildObjectKey(hash, 'image/jpeg')).toBe(
      `content/public-reference/ab/${hash}.jpg`,
    );
    expect(() => buildObjectKey(hash, 'image/svg+xml')).toThrow(
      /Only JPEG, PNG, and WebP/u,
    );
  });

  it('always renders public-reference media through the allowlisted WWW proxy', () => {
    expect(
      buildPublicUrl(
        'laju-chat',
        'content/public-reference/ab/example image.jpg',
      ),
    ).toBe(
      '/api/content/media/laju-chat/content/public-reference/ab/example%20image.jpg',
    );
  });
});

describe('public-reference media CLI guardrails', () => {
  it('is dry-run by default and caps risky volume controls', () => {
    expect(parseCliArgs([])).toMatchObject({
      apply: false,
      reverify: false,
      limit: 1_000,
      concurrency: 3,
      maxBytes: 10 * 1024 * 1024,
    });
    expect(parseCliArgs(['--apply', '--limit=25']).apply).toBe(true);
    expect(() => parseCliArgs(['--concurrency=9'])).toThrow(/cannot exceed 8/u);
    expect(() => parseCliArgs(['--max-bytes=10485761'])).toThrow(
      /cannot exceed/u,
    );
  });

  it('rejects an apply schema that lacks the curated scope constraint', async () => {
    const pool = {
      query: vi.fn().mockResolvedValue({
        rows: [
          {
            assets_ready: true,
            links_ready: true,
            curated_links_ready: true,
            curated_scope_ready: false,
          },
        ],
      }),
    };

    await expect(assertProvenanceSchema(pool)).rejects.toThrow(
      /20260730154000/u,
    );
  });

  it('requires an exact versioned contextual Commons mapping', () => {
    const valid = {
      slug: 'pasar-beringharjo-yogyakarta-open-data',
      commons_file: 'File:Jalan-jalan ke Pasar Beringharjo-12.jpg',
      context_only: true,
      curated_by: 'Lajukan open-data seed 20260723093000',
      curated_at: '2026-07-23T00:00:00.000Z',
      evidence_url:
        'https://commons.wikimedia.org/wiki/File:Jalan-jalan_ke_Pasar_Beringharjo-12.jpg',
      note: 'Context media for a non-transactional public market reference.',
    };
    expect(validateCuratedManifestEntry(valid)).toMatchObject({
      slug: valid.slug,
      commonsFile: valid.commons_file,
      contextOnly: true,
    });
    expect(() =>
      validateCuratedManifestEntry({ ...valid, context_only: false }),
    ).toThrow(/context_only/u);
    expect(() =>
      validateCuratedManifestEntry({
        ...valid,
        evidence_url:
          'https://commons.wikimedia.org/wiki/File:Different_place.jpg',
      }),
    ).toThrow(/same exact Commons File/u);
  });

  it('requires an explicit human-reviewed physical-POI mapping for P18', () => {
    const valid = {
      external_id: 'node/123',
      wikidata_id: 'Q123',
      commons_file: 'File:Exact_POI_photo.jpg',
      physical_poi_verified: true,
      approved_by: 'Lajukan data reviewer',
      approved_at: '2024-01-01T00:00:00.000Z',
      evidence_url: 'https://www.openstreetmap.org/node/123',
      note: 'Facade and coordinates were manually matched to this exact POI.',
    };
    expect(validateReviewedManifestEntry(valid)).toMatchObject({
      externalId: 'node/123',
      wikidataId: 'Q123',
      commonsFile: 'File:Exact POI photo.jpg',
      approvedBy: 'Lajukan data reviewer',
    });
    expect(() =>
      validateReviewedManifestEntry({
        ...valid,
        physical_poi_verified: false,
      }),
    ).toThrow(/explicitly be true/u);
    expect(() =>
      validateReviewedManifestEntry({
        ...valid,
        commons_file: 'Category:Markets in Indonesia',
      }),
    ).toThrow(/exact structured identifiers/u);
  });
});
