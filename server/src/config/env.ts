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
  // One generic approved WATI template, reused for every notification type by passing different
  // text into its parameters (see docs/whatsapp-template.md). Required to reliably reach anyone
  // outside the 24h session window; blank falls back to free-form text everywhere (only
  // deliverable while the recipient has an open WhatsApp session with the business number —
  // testing only).
  WATI_TEMPLATE_NAME: z.string().optional().default(''),
  // AI for the AI Insights page's written analysis: Google Gemini directly, or any model through
  // OpenRouter (https://openrouter.ai). Only the chosen provider's key is needed; without it the
  // page still shows every computed figure, just no AI narrative. Models are configurable so they
  // can be switched without a code change.
  AI_PROVIDER: z.enum(['gemini', 'openrouter']).default('gemini'),
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_MODEL: z.string().optional().default('gemini-3.5-flash-lite'),
  // Tried in order when the main model fails (quota used up, unavailable, overloaded). Comma-separated.
  GEMINI_FALLBACK_MODELS: z.string().optional().default('gemini-3.1-flash-lite,gemini-3.6-flash,gemini-3.8-flash,gemini-3-flash-preview'),
  OPENROUTER_API_KEY: z.string().optional().default(''),
  OPENROUTER_FALLBACK_MODELS: z.string().optional().default(''),
  // Also send the AI the written case details (investigation findings, root causes, CAPA wording,
  // review/return remarks, rejection reasons), de-identified. Off by default: only titles are sent.
  // Ask AI questions per user per day; 0 (default) means no limit
  AI_CHAT_DAILY_LIMIT: z.coerce.number().int().min(0).optional().default(0),
  AI_SHARE_CASE_TEXT: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  OPENROUTER_MODEL: z.string().optional().default('google/gemini-2.5-flash'),
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
