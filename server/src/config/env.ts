import { z } from 'zod';

/**
 * Environment variables the server needs. The server refuses to start if any are missing or invalid,
 * so configuration mistakes show up immediately rather than at the first request that needs them.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  /**
   * Secret used to scramble (hash) SMS codes before they are stored. Kept separate from JWT_SECRET so that
   * each secret does one job, and one can be changed without affecting the other.
   */
  OTP_HASH_SECRET: z.string().min(32, 'OTP_HASH_SECRET must be at least 32 characters'),
  /** Comma-separated web addresses allowed to call the API from a browser (the Flutter web app, admin panel). */
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:8080')
    .transform((v) => v.split(',').map((o) => o.trim()).filter(Boolean)),
  FIELD_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'FIELD_ENCRYPTION_KEY must be 32 bytes, base64 encoded'),
  /** Minutes an access token stays valid. Apps refresh it silently before it runs out. */
  ACCESS_TOKEN_MINUTES: z.coerce.number().int().min(1).max(60).default(15),
  /** Days a signed-in device stays signed in without being used. */
  REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /**
   * Which SMS service sends one-time codes. "log" writes codes to the server log instead of sending them;
   * it is for development and tests only and is refused in production.
   */
  SMS_PROVIDER: z.enum(['log']).default('log'),
  /**
   * Which email service sends codes and notices (decision 35). "log" writes emails to the server log instead of
   * sending them; it is for development and tests only and is refused in production.
   */
  EMAIL_PROVIDER: z.enum(['log']).default('log'),
  /** The sender shown on emails, e.g. "FindHouseQuick <no-reply@findhousequick.com>". */
  EMAIL_FROM: z.string().min(3).default('FindHouseQuick <no-reply@findhousequick.com>'),
}).superRefine((env, ctx) => {
  if (env.OTP_HASH_SECRET === env.JWT_SECRET) {
    ctx.addIssue({ code: 'custom', path: ['OTP_HASH_SECRET'], message: 'OTP_HASH_SECRET must be different from JWT_SECRET' });
  }
  if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'log') {
    ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: 'The "log" SMS provider cannot be used in production' });
  }
  if (env.NODE_ENV === 'production' && env.EMAIL_PROVIDER === 'log') {
    ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'The "log" email provider cannot be used in production' });
  }
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}
