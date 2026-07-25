import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    // `node` by default: core/ and layout/ must not need a DOM at all.
    // Component tests opt in with a `@vitest-environment jsdom` docblock.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // The >=90% gate applies to the framework-free core, as specified.
      include: ['src/core/**/*.ts'],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
})
