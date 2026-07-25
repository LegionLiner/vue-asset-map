import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

/**
 * Library build.
 *
 * Three ESM entries mirror the `exports` map in package.json:
 *   src/index.ts        -> dist/index.js        (".")
 *   src/core/index.ts   -> dist/core/index.js   ("./core")
 *   src/layout/dagre.ts -> dist/layout/dagre.js ("./layout-dagre")
 *
 * `vue`, `@vue-flow/core` and `@dagrejs/dagre` stay external: VueFlow relies on
 * provide/inject, so a second copy in the dependency tree breaks the context.
 */
export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      entryRoot: 'src',
      include: ['src/**/*.ts', 'src/**/*.vue'],
      // Keep one .d.ts per module so the subpath exports resolve their own types.
      rollupTypes: false,
    }),
  ],
  build: {
    target: 'es2022',
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        'core/index': 'src/core/index.ts',
        'layout/dagre': 'src/layout/dagre.ts',
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['vue', '@vue-flow/core', '@dagrejs/dagre'],
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        // Все стили компонентов сводятся в один предсказуемый `dist/style.css` —
        // именно его подключает потребитель через подпуть `./style.css`.
        //
        // Имя ассета читается защитно: Rollup 4 отдаёт `names`, но Vite вызывает
        // этот же коллбэк из своего css-post плагина с объектом, где есть только
        // устаревшее `name`. Обращение сразу к `names` роняет сборку, как только
        // в проекте появляется первый SFC со стилями.
        assetFileNames: (asset) => {
          const names = asset.names ?? (asset.name ? [asset.name] : [])
          return names.some((name) => name.endsWith('.css')) ? 'style.css' : '[name][extname]'
        },
      },
    },
  },
})
