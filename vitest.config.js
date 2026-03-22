import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include:  ['src/domain/**', 'src/adapters/test/**'],
      exclude:  ['src/adapters/browser/**'],
      thresholds: { lines: 85, functions: 85 },
    },
  },
});
