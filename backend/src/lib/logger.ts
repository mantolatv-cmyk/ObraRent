import pino from 'pino';
import { env, isProduction } from '../config/env';

export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  base: { service: 'obra-rent-api' },
  redact: {
    paths: ['req.headers.authorization', 'req.headers["asaas-access-token"]', 'req.headers["x-webhook-token"]', '*.apiKey', '*.accessToken'],
    censor: '[redacted]',
  },
  ...(isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' } } }),
});

export type Logger = typeof logger;
