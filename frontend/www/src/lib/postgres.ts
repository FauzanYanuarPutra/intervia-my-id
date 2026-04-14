import { Pool } from 'pg';

type PostgresGlobal = typeof globalThis & {
  __lajukanPostgresPool?: Pool;
  __lajukanPostgresMissingUrlWarned?: boolean;
};

const postgresGlobal = globalThis as PostgresGlobal;

function parseEnvInt(
  value: string | undefined,
  fallback: number,
  options?: { min?: number; max?: number },
): number {
  const parsed = Number.parseInt(value || '', 10);
  if (!Number.isFinite(parsed)) return fallback;

  const min = options?.min ?? Number.MIN_SAFE_INTEGER;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.max(min, Math.min(max, parsed));
}

function resolveSslConfig() {
  const ssl = (process.env.SUPER_APP_PG_SSL || '').trim().toLowerCase();
  if (!ssl || ssl === 'false' || ssl === '0' || ssl === 'disable') {
    return undefined;
  }

  const insecure =
    ssl === 'allow-insecure' || ssl === 'allow_invalid' || ssl === 'insecure' || ssl === 'no-verify';
  return insecure ? { rejectUnauthorized: false } : {};
}

export function getPostgresPool(): Pool | null {
  const url = (process.env.SUPER_APP_POSTGRES_URL || process.env.DATABASE_URL || '').trim();
  if (!url) {
    if (!postgresGlobal.__lajukanPostgresMissingUrlWarned) {
      postgresGlobal.__lajukanPostgresMissingUrlWarned = true;
      console.warn(
        '[SUPER_APP_POSTGRES_DISABLED] SUPER_APP_POSTGRES_URL (or DATABASE_URL) is not configured.',
      );
    }
    return null;
  }

  if (!postgresGlobal.__lajukanPostgresPool) {
    postgresGlobal.__lajukanPostgresPool = new Pool({
      connectionString: url,
      max: parseEnvInt(process.env.SUPER_APP_PG_POOL_MAX, 30, { min: 1, max: 200 }),
      idleTimeoutMillis: parseEnvInt(process.env.SUPER_APP_PG_IDLE_MS, 30000, {
        min: 1000,
        max: 300000,
      }),
      connectionTimeoutMillis: parseEnvInt(process.env.SUPER_APP_PG_CONN_TIMEOUT_MS, 5000, {
        min: 500,
        max: 60000,
      }),
      statement_timeout: parseEnvInt(process.env.SUPER_APP_PG_STATEMENT_TIMEOUT_MS, 15000, {
        min: 1000,
        max: 120000,
      }),
      query_timeout: parseEnvInt(process.env.SUPER_APP_PG_QUERY_TIMEOUT_MS, 20000, {
        min: 1000,
        max: 180000,
      }),
      application_name: process.env.SUPER_APP_PG_APP_NAME || 'lajukan-www',
      keepAlive: true,
      allowExitOnIdle: false,
      ssl: resolveSslConfig(),
    });

    postgresGlobal.__lajukanPostgresPool.on('error', (error) => {
      console.error('[SUPER_APP_POSTGRES_POOL_ERROR]', error);
    });
  }

  return postgresGlobal.__lajukanPostgresPool;
}
