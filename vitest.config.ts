import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // The fixture loader is test-only plumbing, and index.ts is re-exports.
      exclude: ['src/fixtures.ts', 'src/index.ts', 'src/**/*.test.ts'],
      thresholds: {
        statements: 95,
        lines: 98,
        functions: 100,
        // Lower than the rest on purpose. `noUncheckedIndexedAccess` forces
        // `?? ''` fallbacks on array and record access that the surrounding
        // code has already made unreachable; contriving inputs to reach them
        // would test the type system rather than any behaviour.
        branches: 85,
      },
    },
  },
});
