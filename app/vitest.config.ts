import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Next.js aliases this to an empty module at build time; vitest needs
      // the same so apps/web/src/lib/*.ts files that import 'server-only'
      // (a boundary marker, not real runtime code) can be unit tested.
      'server-only': fileURLToPath(new URL('./vitest.server-only-stub.js', import.meta.url)),
      // A Next.js tsconfig path-aliasai (apps/web/tsconfig.json) — enélkül
      // minden olyan modul tesztelhetetlen, ami `@app/...`-ot importál
      // (2026-09-16: a social-caption.ts a WATCH_LIST-et így hozza be, és
      // emiatt a brief-megfelelési linter el sem indult).
      '@app': fileURLToPath(new URL('./apps/web/app', import.meta.url)),
      '@': fileURLToPath(new URL('./apps/web/src', import.meta.url)),
    },
  },
  // A Next.js az automatikus JSX-runtime-ot használja (tsconfig: "jsx":
  // "preserve" → a bundler dönt). Vitest alatt az esbuild alapértelmezése a
  // KLASSZIKUS transzform, ami `React.createElement`-et vár — emiatt minden
  // .tsx modul (pl. social-image.tsx) "React is not defined"-dal halt el, és
  // a kép-render egyáltalán nem volt tesztelhető.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    globals: false,
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/tests/e2e/**'],
  },
});
