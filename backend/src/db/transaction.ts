import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { logger } from '../lib/logger';
import { pool } from './pool';

/**
 * Runs `fn` inside BEGIN/COMMIT. Any thrown error triggers ROLLBACK and is
 * re-thrown untouched so domain errors keep their HTTP semantics.
 */
export async function withTransaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      logger.error({ err: rollbackErr }, 'ROLLBACK failed');
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Nested unit of work inside an existing transaction. On failure only the work
 * done since the savepoint is undone; the outer transaction stays usable.
 */
export async function withSavepoint<T>(tx: PoolClient, fn: () => Promise<T>): Promise<T> {
  const name = `sp_${randomUUID().replace(/-/g, '')}`;
  await tx.query(`SAVEPOINT ${name}`);
  try {
    const result = await fn();
    await tx.query(`RELEASE SAVEPOINT ${name}`);
    return result;
  } catch (err) {
    await tx.query(`ROLLBACK TO SAVEPOINT ${name}`);
    throw err;
  }
}

/** Uses the caller's transaction (via savepoint) when given, otherwise opens a new one. */
export function inTransaction<T>(tx: PoolClient | undefined, fn: (tx: PoolClient) => Promise<T>): Promise<T> {
  return tx ? withSavepoint(tx, () => fn(tx)) : withTransaction(fn);
}
