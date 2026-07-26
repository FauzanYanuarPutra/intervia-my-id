import { describe, expect, it } from 'vitest';
import {
  normalizePhotonFeatures,
  suggestionFromPhoton,
} from './photon-location-provider';

describe('photon location provider', () => {
  it('keeps street and administrative detail in a road suggestion', () => {
    const suggestion = suggestionFromPhoton({
      geometry: { coordinates: [107.6491, -6.9012] },
      properties: {
        osm_type: 'W',
        osm_id: 123,
        osm_key: 'highway',
        osm_value: 'residential',
        type: 'street',
        name: 'Jalan Cikutra',
        district: 'Neglasari',
        city: 'Bandung',
        state: 'Jawa Barat',
        country: 'Indonesia',
        countrycode: 'ID',
      },
    });

    expect(suggestion?.resultType).toBe('road');
    expect(suggestion?.primaryText).toBe('Jalan Cikutra');
    expect(suggestion?.secondaryText).toContain(
      'Neglasari, Bandung, Jawa Barat',
    );
    expect(suggestion?.selectedLocation?.formattedAddress).toContain(
      'Jalan Cikutra',
    );
  });

  it('formats a detailed house number as a human-readable address', () => {
    const suggestion = suggestionFromPhoton({
      geometry: { coordinates: [107.6021243, -6.914258] },
      properties: {
        osm_type: 'N',
        osm_id: 10693460294,
        type: 'house',
        name: 'Bandung',
        housenumber: '43',
        street: 'Jalan Kebon Kawung',
        district: 'Pasir Kaliki',
        city: 'Bandung',
        state: 'Jawa Barat',
        country: 'Indonesia',
      },
    });

    expect(suggestion?.resultType).toBe('address');
    expect(suggestion?.secondaryText).toContain('Jalan Kebon Kawung No. 43');
    expect(suggestion?.selectedLocation?.latitude).toBe(-6.914258);
    expect(suggestion?.selectedLocation?.longitude).toBe(107.602124);
  });

  it('deduplicates repeated OSM features and honors the result limit', () => {
    const feature = {
      geometry: { coordinates: [112.7521, -7.2575] },
      properties: {
        osm_type: 'R',
        osm_id: 999,
        type: 'city',
        name: 'Surabaya',
        state: 'Jawa Timur',
        country: 'Indonesia',
      },
    };

    const results = normalizePhotonFeatures(
      [
        feature,
        feature,
        {
          geometry: { coordinates: [112.75, -7.26] },
          properties: {
            osm_type: 'W',
            osm_id: 1000,
            type: 'street',
            name: 'Jalan Surabaya',
            city: 'Surabaya',
          },
        },
      ],
      2,
    );

    expect(results).toHaveLength(2);
    expect(results.map(result => result.placeId)).toEqual([
      'osm:R:999',
      'osm:W:1000',
    ]);
  });

  it('ranks detailed results near an exact city above same-name remote areas', () => {
    const results = normalizePhotonFeatures(
      [
        {
          geometry: { coordinates: [112.7521, -7.2575] },
          properties: {
            osm_type: 'R',
            osm_id: 1,
            type: 'city',
            name: 'Surabaya',
            state: 'Jawa Timur',
          },
        },
        {
          geometry: { coordinates: [103.8, -3.7] },
          properties: {
            osm_type: 'N',
            osm_id: 2,
            type: 'city',
            name: 'Surabaya',
            state: 'Sumatera Selatan',
          },
        },
        {
          geometry: { coordinates: [112.75, -7.26] },
          properties: {
            osm_type: 'N',
            osm_id: 3,
            type: 'house',
            name: 'Surabaya Gubeng',
            street: 'Jalan Stasiun Gubeng',
            city: 'Surabaya',
            state: 'Jawa Timur',
          },
        },
      ],
      3,
      'surabaya',
    );

    expect(results.map(result => result.placeId)).toEqual([
      'osm:R:1',
      'osm:N:3',
      'osm:N:2',
    ]);
  });
});
