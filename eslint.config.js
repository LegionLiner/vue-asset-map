import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'

export default defineConfigWithVueTs(
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'playground/dist/**',
      'docs/.vitepress/dist/**',
      'docs/.vitepress/cache/**',
      '**/*.tsbuildinfo',
    ],
  },
  pluginVue.configs['flat/recommended'],
  vueTsConfigs.recommended,
  {
    name: 'vue-asset-map/rules',
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
          selector: 'TSAsExpression > TSUnknownKeyword',
          message: 'Double casts through `unknown` are banned. Narrow with a type guard instead.',
        },
      ],
      'vue/multi-word-component-names': 'off',
      'vue/require-default-prop': 'off',
      'vue/block-order': ['error', { order: ['script', 'template', 'style'] }],
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/html-self-closing': 'off',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    name: 'vue-asset-map/pure-core',
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
    name: 'vue-asset-map/tests',
    files: ['tests/**/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    name: 'vue-asset-map/docs',
    files: ['docs/**/*.ts', 'docs/**/*.vue'],
    languageOptions: { parserOptions: { projectService: false, project: false } },
    rules: {
      'no-console': 'off',
    },
  },
  {
    name: 'vue-asset-map/configs',
    files: ['*.config.ts', '*.config.js', 'playground/**/*.ts', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
    },
  },
)
