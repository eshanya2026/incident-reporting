// Runs before every test file, before any app code loads (vitest.config.ts > setupFiles).
//
// The app reads ../.env, which on a developer machine is the production configuration (live
// WATI and AI keys, NODE_ENV=production). dotenv never overwrites a variable that is already
// set, so pinning these here guarantees no test can send a real WhatsApp message or email, call
// a paid AI model, or run with production settings, whatever is in .env.
const pin: Record<string, string> = {
  NODE_ENV: 'test',
  WHATSAPP_NOTIFICATIONS: 'false',
  WATI_API_ENDPOINT: '',
  WATI_ACCESS_TOKEN: '',
  WATI_TEMPLATE_NAME: '',
  WATI_WEBHOOK_SECRET: 'test-webhook-secret-0123456789',
  EMAIL_NOTIFICATIONS: 'false',
  SMTP_HOST: '',
  SMTP_USER: '',
  SMTP_PASSWORD: '',
  GEMINI_API_KEY: '',
  OPENROUTER_API_KEY: '',
  JWT_ACCESS_SECRET: 'test-access-secret-not-for-production',
  JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-production',
  TRUST_PROXY: '0',
  APP_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:5000',
  FILE_STORAGE_PATH: 'uploads-test',
};
for (const [key, value] of Object.entries(pin)) process.env[key] = value;
