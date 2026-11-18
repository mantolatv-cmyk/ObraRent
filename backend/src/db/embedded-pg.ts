import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import type { QueryResult, QueryResultRow } from 'pg';
import { logger } from '../lib/logger';
import { INIT_SQL, SEED_SQL } from './sql-bundle';

let instancePromise: Promise<PGlite> | null = null;

function resolvePgliteDistDir(): string | null {
  const candidates: string[] = [];
  try {
    const resolved = require.resolve('@electric-sql/pglite');
    candidates.push(path.dirname(resolved));
  } catch {
    // ignore
  }
  candidates.push(
    path.join(process.cwd(), 'node_modules/@electric-sql/pglite/dist'),
    path.join(process.cwd(), 'backend/node_modules/@electric-sql/pglite/dist'),
    path.join(__dirname, '../../node_modules/@electric-sql/pglite/dist'),
    path.join(__dirname, '../node_modules/@electric-sql/pglite/dist'),
    path.join(__dirname, 'node_modules/@electric-sql/pglite/dist'),
  );

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'pglite.wasm')) && fs.existsSync(path.join(dir, 'pglite.data'))) {
      return dir;
    }
  }
  return null;
}

async function createPgliteInstance(dataDir?: string): Promise<{ db: PGlite; hasBtreeGist: boolean }> {
  const distDir = resolvePgliteDistDir();
  if (distDir) {
    try {
      // Explicit file reads so @vercel/nft traces WASM/data assets and bundled code resolves them reliably
      const pgliteWasmBytes = fs.readFileSync(path.join(distDir, 'pglite.wasm'));
      const initdbWasmBytes = fs.readFileSync(path.join(distDir, 'initdb.wasm'));
      const pgliteDataBytes = fs.readFileSync(path.join(distDir, 'pglite.data'));
      const btreeGistPath = path.join(distDir, 'btree_gist.tar.gz');

      const wasmGlobal = (globalThis as unknown as {
        WebAssembly: { compile(bytes: Uint8Array): Promise<unknown> };
      }).WebAssembly;
      const [pgliteWasmModule, initdbWasmModule] = await Promise.all([
        wasmGlobal.compile(pgliteWasmBytes),
        wasmGlobal.compile(initdbWasmBytes),
      ]);
      const fsBundle = new Blob([pgliteDataBytes]);

      if (fs.existsSync(btreeGistPath)) {
        // Touch file so @vercel/nft traces btree_gist.tar.gz
        fs.statSync(btreeGistPath);
        const customBtreeGist = {
          name: 'btree_gist',
          setup: async () => ({ bundlePath: pathToFileURL(btreeGistPath) }),
        };
        const db = await PGlite.create({
          dataDir,
          pgliteWasmModule: pgliteWasmModule as never,
          initdbWasmModule: initdbWasmModule as never,
          fsBundle,
          extensions: { btree_gist: customBtreeGist },
        });
        return { db, hasBtreeGist: true };
      }

      const db = await PGlite.create({
        dataDir,
        pgliteWasmModule: pgliteWasmModule as never,
        initdbWasmModule: initdbWasmModule as never,
        fsBundle,
      });
      return { db, hasBtreeGist: false };
    } catch (err) {
      logger.warn({ err }, 'Explicit PGlite asset load failed; falling back to default PGlite.create');
    }
  }

  try {
    const db = await PGlite.create({ dataDir, extensions: { btree_gist } });
    return { db, hasBtreeGist: true };
  } catch {
    const db = await PGlite.create({ dataDir });
    return { db, hasBtreeGist: false };
  }
}

function stripBtreeGist(sql: string): string {
  return sql
    .replace(/CREATE EXTENSION IF NOT EXISTS btree_gist;/gi, '')
    .replace(/,\s*CONSTRAINT excl_asset_double_booking EXCLUDE USING gist[\s\S]*?WHERE \(blocks_inventory\)/gi, '');
}

async function initEmbeddedPg(): Promise<PGlite> {
  const dataDir = process.env.DEV_DB_DIR ? path.resolve(process.env.DEV_DB_DIR) : undefined;
  const { db, hasBtreeGist } = await createPgliteInstance(dataDir);

  // Return DATE (OID 1082) as 'YYYY-MM-DD' string to match pg type parser
  db.parsers[1082] = (val: string) => val;

  const initSql = hasBtreeGist ? INIT_SQL : stripBtreeGist(INIT_SQL);
  const seedSql = SEED_SQL;

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
    await db.exec(hasBtreeGist ? stripBtreeGist(INIT_SQL) : initSql);
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
