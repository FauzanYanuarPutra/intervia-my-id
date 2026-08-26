import path from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      name: 'server-only-test-stub',
      resolveId(id) {
        return id === 'server-only' ? '\0server-only-test-stub' : undefined;
      },
      load(id) {
        return id === '\0server-only-test-stub' ? '' : undefined;
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    exclude: ['**/node_modules/**', '**/.next/**', '**/out/**'],
    environment: 'node',
    globals: true,
  },
});
