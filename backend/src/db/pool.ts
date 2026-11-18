import pg, { type Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { embeddedPool } from './embedded-pg';
import { INIT_SQL, SEED_SQL } from './sql-bundle';

const { Pool: PgPool, types } = pg;

// Return DATE columns as plain 'YYYY-MM-DD' strings (never shift to local tz).
types.setTypeParser(1082, (value: string) => value);

const rawDbUrl = process.env.DATABASE_URL?.trim() || '';
const isLocalhostDb =
  !rawDbUrl ||
  /^postgres(?:ql)?:\/\/[^@]+@(?:localhost|127\.0\.0\.1)(?::\d+)?\//i.test(rawDbUrl);

const useEmbeddedByDefault =
  process.env.USE_EXTERNAL_PG !== 'true' &&
  (env.NODE_ENV === 'development' || isLocalhostDb);

const isCloudOrSsl =
  env.DB_SSL ||
  Boolean(env.DATABASE_URL?.includes('sslmode=require')) ||
  Boolean(env.DATABASE_URL?.includes('neon.tech')) ||
  Boolean(env.DATABASE_URL?.includes('supabase.co')) ||
  Boolean(process.env.VERCEL);

const pgPool = useEmbeddedByDefault
  ? null
  : new PgPool({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      ssl: isCloudOrSsl ? { rejectUnauthorized: false } : undefined,
      application_name: 'obra-rent-api',
    });

pgPool?.on('error', (err) => {
  logger.error({ err }, 'Unexpected idle PostgreSQL client error');
});

let fallbackToEmbedded = useEmbeddedByDefault;
let externalInitPromise: Promise<void> | null = null;

async function ensureExternalSchema(activePgPool: Pool): Promise<void> {
  const check = await activePgPool.query<{ count: string }>(`
    SELECT count(*)::text as count
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'equipment_categories';
  `);
  if (check.rows[0]?.count === '0') {
    await activePgPool.query(INIT_SQL);
    await activePgPool.query(SEED_SQL);
    logger.info('External PostgreSQL schema & catalog seed auto-initialized');
  } else {
    await activePgPool.query('ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash TEXT;');
    await activePgPool.query('ALTER TABLE rentals ADD COLUMN IF NOT EXISTS delivery_time_slot TEXT;');
  }
}

function isConnectionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code;
  const msg = String((err as { message?: string }).message ?? '');
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    code === 'EAI_AGAIN' ||
    code === '28P01' ||
    code === '3D000' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('Connection terminated') ||
    msg.includes('timeout expired')
  );
}

async function getActiveBackend(): Promise<Pool> {
  if (fallbackToEmbedded || !pgPool) {
    return embeddedPool as unknown as Pool;
  }
  if (!externalInitPromise) {
    externalInitPromise = ensureExternalSchema(pgPool).catch((err) => {
      if (isConnectionError(err)) {
        logger.warn({ err }, 'External PostgreSQL unreachable; falling back to embedded PGlite database');
        fallbackToEmbedded = true;
        return;
      }
      externalInitPromise = null;
      throw err;
    });
  }
  await externalInitPromise;
  return fallbackToEmbedded ? (embeddedPool as unknown as Pool) : pgPool;
}

const resilientPool = {
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    const backend = await getActiveBackend();
    try {
      return await backend.query<R>(text, values as unknown[]);
    } catch (err) {
      if (!fallbackToEmbedded && isConnectionError(err)) {
        logger.warn({ err }, 'External PostgreSQL query failed; falling back to embedded PGlite');
        fallbackToEmbedded = true;
        return (embeddedPool as unknown as Pool).query<R>(text, values as unknown[]);
      }
      throw err;
    }
  },

  async connect(): Promise<PoolClient> {
    const backend = await getActiveBackend();
    try {
      return await backend.connect();
    } catch (err) {
      if (!fallbackToEmbedded && isConnectionError(err)) {
        logger.warn({ err }, 'External PostgreSQL connect failed; falling back to embedded PGlite');
        fallbackToEmbedded = true;
        return (embeddedPool as unknown as Pool).connect();
      }
      throw err;
    }
  },

  async end(): Promise<void> {
    await Promise.allSettled([pgPool?.end(), embeddedPool.end()]);
  },

  on(event: string, listener: (...args: unknown[]) => void) {
    pgPool?.on(event as 'error', listener);
    return this;
  },
};

export const pool: Pool = resilientPool as unknown as Pool;

/**
 * Minimal query surface shared by Pool and PoolClient, so repositories work both
 * standalone and inside a transaction.
 */
export interface Queryable {
  query<R extends QueryResultRow = QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<R>>;
}

export type TxClient = PoolClient;

export async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}
