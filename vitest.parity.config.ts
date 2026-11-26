import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Parity test (issue #12): needs LibreOffice (soffice). Run with `npm run test:parity`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      'server-only': fileURLToPath(new URL('./tests/unit/server-only-stub.ts', import.meta.url)),
    },
  },
  test: { include: ['tests/parity/**/*.test.ts'], environment: 'node', testTimeout: 60_000 },
});
