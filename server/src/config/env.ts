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
  /**
   * Secret used to make lookup fingerprints of ID numbers (and later bank account numbers), so the same number on
   * two accounts can be spotted without storing it readably. Must differ from the other secrets (ADR 0007).
   */
  LOOKUP_HASH_SECRET: z.string().min(32, 'LOOKUP_HASH_SECRET must be at least 32 characters'),
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
  /**
   * Where private files (identity and ownership documents) are kept (ADR 0007). "local" keeps them in a folder on the
   * server and serves uploads through the API; it is for development and tests only and is refused in production.
   */
  STORAGE_PROVIDER: z.enum(['local']).default('local'),
  /**
   * The service that finds faces, number plates, documents and family photographs to blur in property photos
   * (Specification 15.3). "none" finds nothing; a real provider must be set before real users sign up.
   */
  PRIVATE_REGIONS_PROVIDER: z.enum(['none']).default('none'),
  /** The secret that makes the hidden watermark in display photos (Specification 15.3). At least 32 characters. */
  HIDDEN_MARK_KEY: z.string().min(32).default('development-only-hidden-mark-key-change-me'),
  /** Folder used by the "local" storage provider. */
  STORAGE_LOCAL_DIR: z.string().default('.private-storage'),
  /** The API's own address as the apps reach it, used in upload links, e.g. https://api.findhousequick.com. */
  API_PUBLIC_URL: z.string().url().default('http://localhost:3000'),
  /** The public website's address, used in the links scouts share with landlords, e.g. https://findhousequick.com. */
  PUBLIC_WEB_URL: z.string().url().default('http://localhost:3100'),
  /**
   * Whether this server runs background jobs (such as deleting identity photos whose retention period has ended).
   * Needs Redis. Off in the API tests, which call the jobs directly.
   */
  RUN_BACKGROUND_JOBS: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  /**
   * How many proxies (such as Cloudflare and a web server) stand in front of the API. The server then takes the
   * visitor's address from the address header those proxies add, which the viewing limits need (decision 52).
   * 0 means none: the address is taken from the connection itself.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  /**
   * Which push service sends notifications to phones and computers (decision 46). "log" writes them to the server log
   * instead; it is for development and tests only and is refused in production.
   */
  PUSH_PROVIDER: z.enum(['log']).default('log'),
  /**
   * Which calling service carries voice calls inside the app (decision 44). "test" makes made-up connection values and
   * carries no voice; it is for development and tests only and is refused in production.
   */
  CALL_PROVIDER: z.enum(['test']).default('test'),
  /**
   * Which maps service answers place search, nearby amenities and travel times (decision 81): "google", "openstreetmap",
   * or "none" (those features stay empty). The three settings after it send one use to a different provider.
   */
  MAPS_PROVIDER: z.enum(['none', 'google', 'openstreetmap']).default('none'),
  MAPS_PLACES_PROVIDER: z.enum(['none', 'google', 'openstreetmap']).optional(),
  MAPS_AMENITIES_PROVIDER: z.enum(['none', 'google', 'openstreetmap']).optional(),
  MAPS_TRAVEL_PROVIDER: z.enum(['none', 'google', 'openstreetmap']).optional(),
  /** How long to wait for a maps service before carrying on without it, in milliseconds. */
  MAPS_TIMEOUT_MS: z.coerce.number().int().min(500).max(20_000).default(4000),
  /** The Google Maps Platform key (Places API (New) and Routes API). Needed when any use goes to "google". */
  GOOGLE_MAPS_API_KEY: z.string().min(10).optional(),
  /** Where the OpenStreetMap services are: Nominatim (place search), Overpass (amenities) and OSRM (travel times). */
  OSM_SEARCH_URL: z.string().url().optional(),
  OSM_AMENITIES_URL: z.string().url().optional(),
  OSM_ROUTES_URL: z.string().url().optional(),
  /**
   * Who draws the map picture in the apps (decision 81). Follows MAPS_PROVIDER unless set. "google" needs
   * GOOGLE_MAPS_TILES_KEY; "openstreetmap" needs OSM_TILES_URL. Without them the apps say the map is not available.
   */
  MAPS_TILES_PROVIDER: z.enum(['none', 'google', 'openstreetmap']).optional(),
  /** A Google key made only for the Map Tiles API. The apps see it, so limit it in the Google Cloud console. */
  GOOGLE_MAPS_TILES_KEY: z.string().min(10).optional(),
  /** The tile address of an OpenStreetMap host, with {z}, {x} and {y}, e.g. https://tiles.example.com/{z}/{x}/{y}.png */
  OSM_TILES_URL: z.string().url().optional(),
  /** The credit shown on the map; the host may ask for more than the OpenStreetMap one. */
  OSM_TILES_ATTRIBUTION: z.string().min(3).default('© OpenStreetMap contributors'),
  /** Sent to the OpenStreetMap services so their operator knows who is calling. */
  OSM_USER_AGENT: z.string().min(3).default('FindHouseQuick (support@findhousequick.com)'),
  /** The sender shown on emails, e.g. "FindHouseQuick <no-reply@findhousequick.com>". */
  EMAIL_FROM: z.string().min(3).default('FindHouseQuick <no-reply@findhousequick.com>'),
}).superRefine((env, ctx) => {
  if (env.OTP_HASH_SECRET === env.JWT_SECRET) {
    ctx.addIssue({ code: 'custom', path: ['OTP_HASH_SECRET'], message: 'OTP_HASH_SECRET must be different from JWT_SECRET' });
  }
  if (env.LOOKUP_HASH_SECRET === env.JWT_SECRET || env.LOOKUP_HASH_SECRET === env.OTP_HASH_SECRET) {
    ctx.addIssue({ code: 'custom', path: ['LOOKUP_HASH_SECRET'], message: 'LOOKUP_HASH_SECRET must be different from the other secrets' });
  }
  if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'log') {
    ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: 'The "log" SMS provider cannot be used in production' });
  }
  if (env.NODE_ENV === 'production' && env.HIDDEN_MARK_KEY.startsWith('development-only')) {
    ctx.addIssue({ code: 'custom', path: ['HIDDEN_MARK_KEY'], message: 'Set HIDDEN_MARK_KEY to a long random secret in production' });
  }
  if (env.NODE_ENV === 'production' && env.STORAGE_PROVIDER === 'local') {
    ctx.addIssue({ code: 'custom', path: ['STORAGE_PROVIDER'], message: 'The "local" storage provider cannot be used in production' });
  }
  if (env.NODE_ENV === 'production' && env.PUSH_PROVIDER === 'log') {
    ctx.addIssue({ code: 'custom', path: ['PUSH_PROVIDER'], message: 'The "log" push provider cannot be used in production' });
  }
  if (env.NODE_ENV === 'production' && env.CALL_PROVIDER === 'test') {
    ctx.addIssue({ code: 'custom', path: ['CALL_PROVIDER'], message: 'The "test" calling service cannot be used in production' });
  }
  const mapsUses = [
    ['MAPS_PLACES_PROVIDER', env.MAPS_PLACES_PROVIDER ?? env.MAPS_PROVIDER, 'OSM_SEARCH_URL', env.OSM_SEARCH_URL],
    ['MAPS_AMENITIES_PROVIDER', env.MAPS_AMENITIES_PROVIDER ?? env.MAPS_PROVIDER, 'OSM_AMENITIES_URL', env.OSM_AMENITIES_URL],
    ['MAPS_TRAVEL_PROVIDER', env.MAPS_TRAVEL_PROVIDER ?? env.MAPS_PROVIDER, 'OSM_ROUTES_URL', env.OSM_ROUTES_URL],
  ] as const;
  if (mapsUses.some(([, provider]) => provider === 'google') && !env.GOOGLE_MAPS_API_KEY) {
    ctx.addIssue({ code: 'custom', path: ['GOOGLE_MAPS_API_KEY'], message: 'GOOGLE_MAPS_API_KEY is needed when a maps use is set to "google"' });
  }
  for (const [use, provider, urlName, url] of mapsUses) {
    if (provider === 'openstreetmap' && !url) {
      ctx.addIssue({ code: 'custom', path: [urlName], message: `${urlName} is needed when ${use} (or MAPS_PROVIDER) is "openstreetmap"` });
    }
  }
  // Checked only when MAPS_TILES_PROVIDER is set; when it follows MAPS_PROVIDER without its own setting, the map is
  // simply shown as not available.
  const tiles = env.MAPS_TILES_PROVIDER;
  if (tiles === 'google' && !env.GOOGLE_MAPS_TILES_KEY) {
    ctx.addIssue({ code: 'custom', path: ['GOOGLE_MAPS_TILES_KEY'], message: 'GOOGLE_MAPS_TILES_KEY is needed when the map picture comes from "google"' });
  }
  if (tiles === 'openstreetmap' && !env.OSM_TILES_URL) {
    ctx.addIssue({ code: 'custom', path: ['OSM_TILES_URL'], message: 'OSM_TILES_URL is needed when the map picture comes from "openstreetmap"' });
  }
  if (env.OSM_TILES_URL && !['{z}', '{x}', '{y}'].every((p) => env.OSM_TILES_URL!.includes(p))) {
    ctx.addIssue({ code: 'custom', path: ['OSM_TILES_URL'], message: 'OSM_TILES_URL must contain {z}, {x} and {y}' });
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
