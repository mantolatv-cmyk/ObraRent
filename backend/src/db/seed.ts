import { logger } from '../lib/logger';
import { seed } from './migrate';
import { pool } from './pool';

seed()
  .then(() => pool.end())
  .catch(async (err: unknown) => {
    logger.error({ err }, 'Seed failed');
    await pool.end();
    process.exit(1);
  });
