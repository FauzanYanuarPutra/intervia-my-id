import { PoolClient } from 'pg';
import { getPostgresPool } from '@/lib/postgres';
import { detectLocationAnomaly, LatLng } from '@/lib/super-app/location-guard';
import { logSuperAppEvent } from '@/lib/super-app/observability';
import type { SuperAppService } from '@/lib/super-app/dispatch';

type PreviousLocationRow = {
  lat: number;
  lng: number;
  location_updated_at: string;
};

export type IngestDriverLocationInput = {
  driverId: string;
  service: SuperAppService;
  lat: number;
  lng: number;
  headingDeg?: number;
  speedKmh?: number;
  vehicleType?: string;
  orderId?: string;
  source?: string;
  sampleIntervalSeconds?: number;
};

export type IngestDriverLocationResult = {
  persisted: boolean;
  sampledPointInserted: boolean;
  anomaly: {
    isAnomaly: boolean;
    shouldReject: boolean;
    reason?: string;
    speedKmh: number;
    distanceKm: number;
  };
};

export type DispatchOrderSnapshotInput = {
  orderId: string;
  service: SuperAppService;
  requesterId: string;
  status: 'searching' | 'matched' | 'expired' | 'cancelled';
  pickup: LatLng;
  dropoff?: LatLng;
  matchedDriverId?: string;
  matchedAt?: string;
  radiusM?: number;
  notifiedDriverIds?: string[];
};

async function getPreviousLocation(
  client: PoolClient,
  driverId: string,
): Promise<PreviousLocationRow | null> {
  const query = await client.query<PreviousLocationRow>(
    `
      SELECT
        location[1]::double precision AS lat,
        location[0]::double precision AS lng,
        location_updated_at::text
      FROM driver_locations_latest
      WHERE driver_id = $1
      LIMIT 1
    `,
    [driverId],
  );
  return query.rows[0] || null;
}

async function upsertDriverLatest(
  client: PoolClient,
  input: IngestDriverLocationInput,
): Promise<void> {
  await client.query(
    `
      INSERT INTO driver_locations_latest (
        driver_id,
        service_type,
        status,
        location,
        heading_deg,
        speed_kmh,
        vehicle_type,
        source,
        location_updated_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        'online',
        POINT($3, $4),
        $5,
        $6,
        $7,
        $8,
        NOW(),
        NOW(),
        NOW()
      )
      ON CONFLICT (driver_id) DO UPDATE SET
        service_type = EXCLUDED.service_type,
        status = 'online',
        location = EXCLUDED.location,
        heading_deg = EXCLUDED.heading_deg,
        speed_kmh = EXCLUDED.speed_kmh,
        vehicle_type = EXCLUDED.vehicle_type,
        source = EXCLUDED.source,
        location_updated_at = NOW(),
        updated_at = NOW()
    `,
    [
      input.driverId,
      input.service,
      input.lng,
      input.lat,
      input.headingDeg ?? null,
      input.speedKmh ?? null,
      input.vehicleType ?? null,
      input.source || 'gps',
    ],
  );
}

async function shouldInsertSamplePoint(
  client: PoolClient,
  input: { orderId: string; driverId: string; sampleIntervalSeconds: number },
): Promise<boolean> {
  const query = await client.query<{ sampled_at: string }>(
    `
      SELECT sampled_at::text
      FROM trip_location_points
      WHERE order_id = $1 AND driver_id = $2
      ORDER BY sampled_at DESC
      LIMIT 1
    `,
    [input.orderId, input.driverId],
  );
  const last = query.rows[0];
  if (!last?.sampled_at) return true;

  const elapsedMs = Date.now() - new Date(last.sampled_at).getTime();
  return elapsedMs >= input.sampleIntervalSeconds * 1000;
}

async function insertTripSample(
  client: PoolClient,
  input: IngestDriverLocationInput & {
    anomaly: IngestDriverLocationResult['anomaly'];
  },
): Promise<boolean> {
  if (!input.orderId) return false;
  const sampleIntervalSeconds = Math.max(2, Math.min(15, input.sampleIntervalSeconds || 5));

  const allowInsert = await shouldInsertSamplePoint(client, {
    orderId: input.orderId,
    driverId: input.driverId,
    sampleIntervalSeconds,
  });
  if (!allowInsert) return false;

  await client.query(
    `
      INSERT INTO trip_location_points (
        order_id,
        driver_id,
        point,
        speed_kmh,
        heading_deg,
        source,
        is_anomaly,
        anomaly_reason,
        meta,
        sampled_at,
        created_at
      )
      VALUES (
        $1,
        $2,
        POINT($3, $4),
        $5,
        $6,
        $7,
        $8,
        $9,
        $10::jsonb,
        NOW(),
        NOW()
      )
    `,
    [
      input.orderId,
      input.driverId,
      input.lng,
      input.lat,
      input.speedKmh ?? null,
      input.headingDeg ?? null,
      input.source || 'gps',
      input.anomaly.isAnomaly,
      input.anomaly.reason || null,
      JSON.stringify({
        computed_speed_kmh: Number(input.anomaly.speedKmh.toFixed(2)),
        distance_km: Number(input.anomaly.distanceKm.toFixed(4)),
      }),
    ],
  );
  return true;
}

export async function ingestDriverLocation(
  input: IngestDriverLocationInput,
): Promise<IngestDriverLocationResult> {
  const pool = getPostgresPool();
  if (!pool) {
    return {
      persisted: false,
      sampledPointInserted: false,
      anomaly: {
        isAnomaly: false,
        shouldReject: false,
        speedKmh: 0,
        distanceKm: 0,
      },
    };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const previous = await getPreviousLocation(client, input.driverId);
    const anomaly = detectLocationAnomaly({
      previous: previous
        ? {
            lat: previous.lat,
            lng: previous.lng,
            updatedAt: previous.location_updated_at,
          }
        : null,
      next: { lat: input.lat, lng: input.lng },
      hardRejectSpeedKmh: 220,
      hardRejectTeleportKm: 6,
    });

    await upsertDriverLatest(client, input);
    const sampledPointInserted = await insertTripSample(client, {
      ...input,
      anomaly: {
        isAnomaly: anomaly.isAnomaly,
        shouldReject: anomaly.shouldReject,
        reason: anomaly.reason,
        speedKmh: anomaly.speedKmh,
        distanceKm: anomaly.distanceKm,
      },
    });

    await client.query('COMMIT');
    return {
      persisted: true,
      sampledPointInserted,
      anomaly: {
        isAnomaly: anomaly.isAnomaly,
        shouldReject: anomaly.shouldReject,
        reason: anomaly.reason,
        speedKmh: anomaly.speedKmh,
        distanceKm: anomaly.distanceKm,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK');
    logSuperAppEvent('geospatial_ingest_error', {
      driver_id: input.driverId,
      order_id: input.orderId || null,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      persisted: false,
      sampledPointInserted: false,
      anomaly: {
        isAnomaly: false,
        shouldReject: false,
        speedKmh: 0,
        distanceKm: 0,
      },
    };
  } finally {
    client.release();
  }
}

export async function upsertDispatchOrderSnapshot(
  input: DispatchOrderSnapshotInput,
): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) return false;

  try {
    await pool.query(
      `
        INSERT INTO dispatch_orders (
          order_id,
          service_type,
          requester_id,
          matched_driver_id,
          status,
          pickup,
          dropoff,
          last_radius_m,
          notified_driver_ids,
          matched_at,
          expired_at,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          POINT($6, $7),
          CASE WHEN $8::double precision IS NULL OR $9::double precision IS NULL
            THEN NULL
            ELSE POINT($8, $9)
          END,
          $10,
          $11::jsonb,
          $12::timestamptz,
          CASE WHEN $5 = 'expired' THEN NOW() ELSE NULL END,
          NOW(),
          NOW()
        )
        ON CONFLICT (order_id) DO UPDATE SET
          service_type = EXCLUDED.service_type,
          requester_id = EXCLUDED.requester_id,
          matched_driver_id = EXCLUDED.matched_driver_id,
          status = EXCLUDED.status,
          pickup = EXCLUDED.pickup,
          dropoff = EXCLUDED.dropoff,
          last_radius_m = EXCLUDED.last_radius_m,
          notified_driver_ids = EXCLUDED.notified_driver_ids,
          matched_at = EXCLUDED.matched_at,
          expired_at = EXCLUDED.expired_at,
          updated_at = NOW()
      `,
      [
        input.orderId,
        input.service,
        input.requesterId,
        input.matchedDriverId || null,
        input.status,
        input.pickup.lng,
        input.pickup.lat,
        input.dropoff?.lng ?? null,
        input.dropoff?.lat ?? null,
        Math.max(0, Math.round(input.radiusM || 0)),
        JSON.stringify(input.notifiedDriverIds || []),
        input.matchedAt || null,
      ],
    );
    return true;
  } catch (error) {
    logSuperAppEvent('dispatch_snapshot_upsert_error', {
      order_id: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

export async function markDriverOfflineInGeospatial(driverId: string): Promise<boolean> {
  const pool = getPostgresPool();
  if (!pool) return false;

  try {
    await pool.query(
      `
        UPDATE driver_locations_latest
        SET
          status = 'offline',
          updated_at = NOW()
        WHERE driver_id = $1
      `,
      [driverId],
    );
    return true;
  } catch (error) {
    logSuperAppEvent('driver_offline_mark_error', {
      driver_id: driverId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
