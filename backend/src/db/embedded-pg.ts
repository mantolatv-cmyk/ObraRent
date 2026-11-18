import type { QueryResult, QueryResultRow } from 'pg';
import { inMemoryPool } from './in-memory-db';

/**
 * Embedded zero-install database pool.
 * Uses the pure TypeScript in-memory relational engine so serverless bundles
 * (e.g. Vercel Express CJS builds) have zero external WASM/filesystem dependencies
 * and sub-millisecond cold starts.
 */
export const embeddedPool = {
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    return inMemoryPool.query<R>(text, values);
  },

  async connect() {
    return inMemoryPool.connect();
  },

  async end(): Promise<void> {
    return inMemoryPool.end();
  },

  on() {
    return this;
  },
};
