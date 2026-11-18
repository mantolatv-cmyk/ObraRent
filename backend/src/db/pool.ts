import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { embeddedPool } from './embedded-pg';

// Return DATE columns as plain 'YYYY-MM-DD' strings (never shift to local tz).
types.setTypeParser(1082, (value: string) => value);

const useEmbeddedPg = env.NODE_ENV === 'development' && process.env.USE_EXTERNAL_PG !== 'true';

const isCloudOrSsl =
  env.DB_SSL ||
  Boolean(env.DATABASE_URL?.includes('sslmode=require')) ||
  Boolean(env.DATABASE_URL?.includes('neon.tech')) ||
  Boolean(env.DATABASE_URL?.includes('supabase.co')) ||
  Boolean(process.env.VERCEL);

const pgPool = useEmbeddedPg
  ? null
  : new Pool({
      connectionString: env.DATABASE_URL,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: isCloudOrSsl ? { rejectUnauthorized: false } : undefined,
      application_name: 'obra-rent-api',
    });

pgPool?.on('error', (err) => {
  logger.error({ err }, 'Unexpected idle PostgreSQL client error');
});

export const pool: Pool = (useEmbeddedPg ? (embeddedPool as unknown as Pool) : pgPool!);

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
