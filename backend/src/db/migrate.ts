import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../lib/logger';
import { pool } from './pool';
import { withTransaction } from './transaction';

export const DATABASE_DIR = path.resolve(__dirname, '../../../database');

async function listSqlFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir);
  return files.filter((f) => f.endsWith('.sql')).sort();
}

/** Applies pending migrations in lexical order, each inside its own transaction. */
export async function migrate({ reset = false } = {}): Promise<string[]> {
  if (reset) {
    logger.warn('Resetting database schema "public"');
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;');
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name        TEXT PRIMARY KEY,
      applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);

  const dir = path.join(DATABASE_DIR, 'migrations');
  const applied = new Set((await pool.query<{ name: string }>('SELECT name FROM schema_migrations')).rows.map((r) => r.name));
  const executed: string[] = [];

  for (const file of await listSqlFiles(dir)) {
    if (applied.has(file)) continue;
    const sql = await readFile(path.join(dir, file), 'utf8');
    await withTransaction(async (tx) => {
      await tx.query(sql);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    logger.info({ file }, 'Migration applied');
    executed.push(file);
  }
  if (executed.length === 0) logger.info('Database schema is up to date');
  return executed;
}

export async function seed(): Promise<void> {
  const dir = path.join(DATABASE_DIR, 'seeds');
  for (const file of await listSqlFiles(dir)) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    await withTransaction((tx) => tx.query(sql));
    logger.info({ file }, 'Seed applied');
  }
}

if (require.main === module) {
  migrate({ reset: process.argv.includes('--reset') })
    .then(() => pool.end())
    .catch(async (err: unknown) => {
      logger.error({ err }, 'Migration failed');
      await pool.end();
      process.exit(1);
    });
}
