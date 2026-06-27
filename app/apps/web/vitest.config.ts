import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@app': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'app/**/*.test.ts',
      'tests/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/.next/**', '**/tests/e2e/**'],
  },
});
