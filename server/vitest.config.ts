import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Safe settings (no WhatsApp/email/AI, test secrets) before any app code reads .env
    setupFiles: ['./src/test/setupEnv.ts'],
  },
});
