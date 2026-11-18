import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env, isProduction } from './config/env';
import { checkDatabase } from './db/pool';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { authRouter } from './routes/auth.routes';
import { clientsRouter } from './routes/clients.routes';
import { devRouter } from './routes/dev.routes';
import { equipmentRouter } from './routes/equipment.routes';
import { geoRouter } from './routes/geo.routes';
import { rentalsRouter } from './routes/rentals.routes';
import { webhooksRouter } from './routes/webhooks.routes';

function buildExpressApp(): Express {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

  const allowedOrigins = env.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const isVercel = Boolean(process.env.VERCEL);
  app.use(
    cors({
      origin: isVercel ? true : allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  app.get(['/health', '/api/health', '/api/v1/health'], async (_req, res) => {
    const dbOk = await checkDatabase();
    res.status(dbOk ? 200 : 503).json({
      status: dbOk ? 'ok' : 'degraded',
      db: dbOk ? 'up' : 'down',
    });
  });

  const apiV1 = express.Router();
  apiV1.use('/auth', authRouter);
  apiV1.use('/equipment', equipmentRouter);
  apiV1.use('/rentals', rentalsRouter);
  apiV1.use('/clients', clientsRouter);
  apiV1.use('/geo', geoRouter);
  apiV1.use('/webhooks', webhooksRouter);

  if (!isProduction || process.env.ENABLE_DEV_SIMULATOR !== 'false') {
    apiV1.use('/dev', devRouter);
  }

  app.use(['/api/v1', '/v1'], apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = buildExpressApp();

export default app;
