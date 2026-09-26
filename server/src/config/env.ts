import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env from root or server directory
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().transform((val) => parseInt(val, 10)).default('5000'),
  MONGO_URI: z.string().default('mongodb://localhost:27017/incident_db'),
  JWT_ACCESS_SECRET: z.string().default('adhiparasakthi_access_super_secret_key_2026'),
  JWT_REFRESH_SECRET: z.string().default('adhiparasakthi_refresh_super_secret_key_2026'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL: z.string().default('12h'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  FILE_STORAGE_DRIVER: z.enum(['local', 'minio', 's3']).default('local'),
  FILE_STORAGE_PATH: z.string().default('uploads'),
  MAX_FILE_SIZE_MB: z.string().transform((val) => parseInt(val, 10)).default('10'),
  SMTP_HOST: z.string().optional().default('localhost'),
  SMTP_PORT: z.string().transform((val) => parseInt(val, 10)).default('587'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().default('Adhiparasakthi Safety Portal <noreply@adhiparasakthi.hospital>'),
  // Also send notifications by email (uses SMTP_*). In-app notifications are always created.
  EMAIL_NOTIFICATIONS: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  // Also send the HOD a WhatsApp message when Quality assigns an incident to them
  // (uses the WATI WhatsApp Business API — https://wati.io — and the HOD's whatsappNumber).
  WHATSAPP_NOTIFICATIONS: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  // Account's API base URL, e.g. https://live-mt-server.wati.io/123456 (WATI dashboard > API Docs).
  WATI_API_ENDPOINT: z.string().optional().default(''),
  // Bearer token from the same WATI dashboard page.
  WATI_ACCESS_TOKEN: z.string().optional().default(''),
  // Name of the approved template to send (see docs/whatsapp-template.md). Required for the first
  // message to a HOD outside the 24h session window; leave blank to send free-form text instead
  // (only deliverable while the HOD has an open WhatsApp session with the business number).
  WATI_TEMPLATE_NAME: z.string().optional().default(''),
  APP_URL: z.string().default('http://localhost:5173'),
  API_URL: z.string().default('http://localhost:5000'),
  // Number of reverse proxies in front of the API (1 behind Nginx). Needed so rate limits and
  // audit logs see each user's own IP instead of the proxy's. Keep 0 when clients connect directly.
  TRUST_PROXY: z.string().transform((val) => parseInt(val, 10)).default('0'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;

// In production, never run with the built-in / example secrets: anyone who has read the repository
// could forge login tokens.
if (env.NODE_ENV === 'production') {
  const weak = (secret: string) => secret.length < 32 || /change_in_prod|super_secret_key/i.test(secret);
  const problems: string[] = [];
  if (weak(env.JWT_ACCESS_SECRET)) problems.push('JWT_ACCESS_SECRET');
  if (weak(env.JWT_REFRESH_SECRET)) problems.push('JWT_REFRESH_SECRET');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) problems.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  if (problems.length > 0) {
    console.error(
      `❌ Refusing to start in production with weak or default secrets: ${problems.join(', ')}. ` +
        'Set unique random values of at least 32 characters (e.g. `openssl rand -hex 48`).'
    );
    process.exit(1);
  }
}
