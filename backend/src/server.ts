import { createApp } from './create-app';
import { env } from './config/env';
import { pool } from './db/pool';
import { logger } from './lib/logger';
import { rentalRepository } from './repositories/rental.repository';

const app = createApp();
(app as unknown as { default: typeof app; app: typeof app }).default = app;
(app as unknown as { default: typeof app; app: typeof app }).app = app;

async function bootstrap(): Promise<void> {
  // Warm up database connection / embedded PGlite instance on boot
  await pool.query('SELECT 1');

  // Periodic sweeper that expires unpaid reservations after PAYMENT_HOLD_MINUTES
  const sweeper = setInterval(() => {
    rentalRepository
      .expireOverduePendingRentals(pool)
      .then((count) => {
        if (count > 0) {
          logger.info({ expiredCount: count }, 'Expired overdue PENDING_PAYMENT rentals');
        }
      })
      .catch((err: unknown) => {
        logger.warn({ err }, 'Reservation hold sweeper failed');
      });
  }, env.SWEEPER_INTERVAL_SECONDS * 1000);
  sweeper.unref();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'Mantovani API listening');
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down server');
    clearInterval(sweeper);
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// In standard server environments (local dev, docker, standalone), start listening.
// In Vercel serverless environments, Vercel invokes the exported app instance directly.
if (!process.env.VERCEL) {
  bootstrap().catch((err: unknown) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
}

export default app;
