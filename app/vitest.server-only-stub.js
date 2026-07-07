// Empty stub for the 'server-only' package during vitest runs. Next.js
// aliases 'server-only' to a no-op at build time; vitest.config.ts mirrors
// that so apps/web/src/lib/*.ts files importing it stay unit-testable.
export {};
