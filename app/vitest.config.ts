import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Next.js aliases this to an empty module at build time; vitest needs
      // the same so apps/web/src/lib/*.ts files that import 'server-only'
      // (a boundary marker, not real runtime code) can be unit tested.
      'server-only': fileURLToPath(new URL('./vitest.server-only-stub.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: false,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/tests/e2e/**'],
  },
});
