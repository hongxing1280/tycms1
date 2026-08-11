import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/*.test.ts', 'apps/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@sports/config': new URL('./packages/config/src/index.ts', import.meta.url).pathname,
      '@sports/core': new URL('./packages/core/src/index.ts', import.meta.url).pathname,
      '@sports/db': new URL('./packages/db/src/index.ts', import.meta.url).pathname,
      '@sports/seo': new URL('./packages/seo/src/index.ts', import.meta.url).pathname,
      '@sports/templates': new URL('./packages/templates/src/index.ts', import.meta.url).pathname,
      '@sports/ui': new URL('./packages/ui/src/index.ts', import.meta.url).pathname,
    },
  },
});
