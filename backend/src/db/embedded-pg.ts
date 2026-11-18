import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import type { QueryResult, QueryResultRow } from 'pg';
import { logger } from '../lib/logger';

let instancePromise: Promise<PGlite> | null = null;

async function initEmbeddedPg(): Promise<PGlite> {
  const dataDir = process.env.DEV_DB_DIR ? path.resolve(process.env.DEV_DB_DIR) : undefined;
  const db = await PGlite.create({ dataDir, extensions: { btree_gist } });
  // Return DATE (OID 1082) as 'YYYY-MM-DD' string to match pg type parser
  db.parsers[1082] = (val: string) => val;

  const dbRoot = path.resolve(__dirname, '../../../database');
  const initSql = await readFile(path.join(dbRoot, 'migrations/001_init.sql'), 'utf8');
  const seedSql = await readFile(path.join(dbRoot, 'seeds/001_catalog.sql'), 'utf8');

  try {
    const check = await db.query<{ count: string }>(`
      SELECT count(*)::text as count FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'equipment_categories';
    `);
    if (check.rows[0]?.count === '0') {
      await db.exec(initSql);
      await db.exec(seedSql);
      logger.info('Embedded PostgreSQL (PGlite WASM) initialized with migrations and catalog seed');
    } else {
      await db.exec('ALTER TABLE clients ADD COLUMN IF NOT EXISTS password_hash TEXT;');
      await db.exec('ALTER TABLE rentals ADD COLUMN IF NOT EXISTS delivery_time_slot TEXT;');
      logger.info('Embedded PostgreSQL (PGlite WASM) ready with existing database');
    }
  } catch {
    await db.exec(initSql);
    await db.exec(seedSql);
    logger.info('Embedded PostgreSQL (PGlite WASM) initialized with migrations and catalog seed');
  }

  return db;
}

export function getEmbeddedPg(): Promise<PGlite> {
  if (!instancePromise) {
    instancePromise = initEmbeddedPg();
  }
  return instancePromise;
}

/**
 * Serializes transactions and standalone queries on single-session PGlite so
 * concurrent HTTP requests never interleave `BEGIN ... COMMIT` blocks.
 */
class AsyncMutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<() => void> {
    if (!this.locked) {
      this.locked = true;
      return () => this.release();
    }
    return new Promise<() => void>((resolve) => {
      this.queue.push(() => resolve(() => this.release()));
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

const txMutex = new AsyncMutex();

async function rawExecute<R extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<R>> {
  const db = await getEmbeddedPg();
  const res = await db.query<R>(text, values);
  return {
    command: '',
    oid: 0,
    fields: [],
    rows: res.rows,
    rowCount: res.affectedRows ?? res.rows.length,
  };
}

export const embeddedPool = {
  async query<R extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<QueryResult<R>> {
    const release = await txMutex.acquire();
    try {
      return await rawExecute<R>(text, values);
    } finally {
      release();
    }
  },

  async connect() {
    const release = await txMutex.acquire();
    let released = false;
    return {
      async query<R extends QueryResultRow = QueryResultRow>(
        text: string,
        values?: unknown[],
      ): Promise<QueryResult<R>> {
        return rawExecute<R>(text, values);
      },
      release() {
        if (!released) {
          released = true;
          release();
        }
      },
    };
  },

  async end(): Promise<void> {
    if (instancePromise) {
      const db = await instancePromise;
      instancePromise = null;
      await db.close();
    }
  },

  on() {
    return this;
  },
};
