import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

/**
 * The interesting part of this config is the `src/core` + `src/layout` block:
 * those trees are framework-free by contract, and the restricted-imports rule is
 * what actually enforces it (acceptance criterion, not a convention).
 */
export default defineConfigWithVueTs(
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'playground/dist/**', '**/*.tsbuildinfo'],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    name: 'network-map/rules',
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': 'allow-with-description', 'ts-nocheck': true },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-restricted-syntax': [
        'error',
        {
          // `as unknown as X` double-casts are banned; use a type guard instead.
          selector: 'TSAsExpression > TSUnknownKeyword',
          message: 'Double casts through `unknown` are banned. Narrow with a type guard instead.',
        },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    name: 'network-map/pure-core',
    files: ['src/core/**/*.ts', 'src/layout/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'vue', message: 'src/core and src/layout must stay framework-free.' },
            { name: '@vue-flow/core', message: 'src/core and src/layout must stay renderer-agnostic.' },
          ],
          patterns: [
            {
              group: ['vue/*', '@vue-flow/*', '**/composables/*', '**/components/*', '**/theme/*'],
              message: 'src/core and src/layout must not depend on the Vue layer.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'network-map/tests',
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    name: 'network-map/configs',
    files: ['*.config.ts', '*.config.js', 'playground/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
)
