/**
 * Zero-install local PostgreSQL for development: runs PGlite (Postgres 17
 * compiled to WASM) behind the Postgres wire protocol on DEV_DB_PORT (5432).
 *
 *   npm run db:dev            # in-memory
 *   DEV_DB_DIR=.pgdata npm run db:dev   # persisted to disk
 *
 * PGlite is single-session: point the API at it with DB_POOL_MAX=1.
 * For staging/production use a real PostgreSQL (see docker-compose.yml).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

async function main(): Promise<void> {
  const port = Number(process.env.DEV_DB_PORT ?? 5432);
  const dataDir = process.env.DEV_DB_DIR;
  const db = await PGlite.create({ dataDir, extensions: { btree_gist } });

  // Bootstrap schema_migrations table so `npm run db:migrate` is also a clean no-op if already applied
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  const existing = await db.query<{ name: string }>('SELECT name FROM schema_migrations WHERE name = $1', ['001_init.sql']);
  if (existing.rows.length === 0) {
    const dbRoot = path.resolve(__dirname, '../../../database');
    const initSql = await readFile(path.join(dbRoot, 'migrations/001_init.sql'), 'utf8');
    const seedSql = await readFile(path.join(dbRoot, 'seeds/001_catalog.sql'), 'utf8');
    await db.exec(initSql);
    await db.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', ['001_init.sql']);
    await db.exec(seedSql);
  }

  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
  await server.start();
  console.log(`PGlite dev server listening on postgres://postgres@127.0.0.1:${port}/obra_rent ${dataDir ? `(data: ${dataDir})` : '(in-memory)'}`);

  const shutdown = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
