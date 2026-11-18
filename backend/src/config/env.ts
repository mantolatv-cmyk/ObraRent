import { z } from 'zod';

/**
 * Centralised, validated configuration. The process fails fast on boot when a
 * required variable is missing or malformed instead of failing on first use.
 */
const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const defaultPublicUrl = process.env.PUBLIC_APP_URL
  ? process.env.PUBLIC_APP_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.string().min(1).default('postgres://postgres:postgres@localhost:5432/obra_rent'),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_SSL: bool.default(false),

  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  PUBLIC_APP_URL: z.string().url().default(defaultPublicUrl),

  // Rental rules
  PAYMENT_HOLD_MINUTES: z.coerce.number().int().min(5).max(24 * 60).default(30),
  MAX_RENTAL_DAYS: z.coerce.number().int().positive().default(180),
  MAX_ADVANCE_BOOKING_DAYS: z.coerce.number().int().positive().default(365),
  SWEEPER_INTERVAL_SECONDS: z.coerce.number().int().min(5).default(60),

  // Freight (eliminado da conta de diárias por padrão)
  DEPOT_CEP: z.string().regex(/^\d{8}$/).default('01001000'),
  DEPOT_LATITUDE: z.coerce.number().default(-23.5503),
  DEPOT_LONGITUDE: z.coerce.number().default(-46.6339),
  FREIGHT_BASE: z.coerce.number().nonnegative().default(0),
  FREIGHT_PER_KM: z.coerce.number().nonnegative().default(0),
  FREIGHT_PER_EXTRA_UNIT: z.coerce.number().nonnegative().default(0),

  // Payment gateway
  PAYMENT_GATEWAY: z.enum(['mock', 'asaas']).default('mock'),
  GATEWAY_WEBHOOK_TOKEN: z.string().min(8).default('dev-gateway-webhook-token'),
  ASAAS_API_URL: z.string().url().default('https://api-sandbox.asaas.com/v3'),
  ASAAS_API_KEY: z.string().optional(),
  PIX_KEY: z.string().default('00000000000191'),
  PIX_MERCHANT_NAME: z.string().default('MANTOVANI LOCACOES'),
  PIX_MERCHANT_CITY: z.string().default('SAO PAULO'),

  // External lookups
  CEP_LOOKUP_URL: z.string().url().default('https://viacep.com.br/ws'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),

  // WhatsApp
  MESSAGING_PROVIDER: z.enum(['console', 'evolution', 'meta']).default('console'),
  WHATSAPP_WEBHOOK_TOKEN: z.string().optional(),
  WHATSAPP_SESSION_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(120),
  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  META_GRAPH_URL: z.string().url().default('https://graph.facebook.com/v21.0'),
  META_PHONE_NUMBER_ID: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  const env = parsed.data;

  if (env.PAYMENT_GATEWAY === 'asaas' && !env.ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY is required when PAYMENT_GATEWAY=asaas');
  }
  if (env.MESSAGING_PROVIDER === 'evolution' && !(env.EVOLUTION_API_URL && env.EVOLUTION_API_KEY && env.EVOLUTION_INSTANCE)) {
    throw new Error('EVOLUTION_API_URL, EVOLUTION_API_KEY and EVOLUTION_INSTANCE are required when MESSAGING_PROVIDER=evolution');
  }
  if (env.MESSAGING_PROVIDER === 'meta' && !(env.META_PHONE_NUMBER_ID && env.META_ACCESS_TOKEN)) {
    throw new Error('META_PHONE_NUMBER_ID and META_ACCESS_TOKEN are required when MESSAGING_PROVIDER=meta');
  }
  if (env.NODE_ENV === 'production' && env.GATEWAY_WEBHOOK_TOKEN === 'dev-gateway-webhook-token') {
    throw new Error('GATEWAY_WEBHOOK_TOKEN must be set to a strong secret in production');
  }
  return env;
}

export const env: Env = loadEnv();
export const isProduction = env.NODE_ENV === 'production';
