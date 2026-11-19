import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // 'server-only' throws outside React Server Components; unit tests run in plain Node.
      'server-only': fileURLToPath(new URL('./tests/unit/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: { provider: 'v8', include: ['lib/**/*.ts'], exclude: ['lib/types*.ts', 'lib/supabase/**'] },
  },
});
