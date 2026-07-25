import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * Плейграунд смотрит на исходники библиотеки через alias, а не на `dist`:
 * правки видны без пересборки. Реальный путь потребителя (установка собранного
 * пакета) проверяется отдельно — упаковкой `npm pack` в чистое приложение.
 */
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  resolve: {
    // Массив с регулярками, а не объект: строковый ключ `vue-asset-map` перехватил
    // бы и подпуть `vue-asset-map/style.css`, который должен вести в CSS, а не в
    // точку входа. Алиасы повторяют карту `exports` из package.json.
    alias: [
      {
        find: /^vue-asset-map\/style\.css$/,
        replacement: fileURLToPath(new URL('../src/theme/index.css', import.meta.url)),
      },
      {
        find: /^vue-asset-map\/core$/,
        replacement: fileURLToPath(new URL('../src/core/index.ts', import.meta.url)),
      },
      {
        find: /^vue-asset-map\/layout-dagre$/,
        replacement: fileURLToPath(new URL('../src/layout/dagre.ts', import.meta.url)),
      },
      {
        find: /^vue-asset-map$/,
        replacement: fileURLToPath(new URL('../src/index.ts', import.meta.url)),
      },
      {
        find: /^@fixtures\//,
        replacement: `${fileURLToPath(new URL('../fixtures', import.meta.url))}/`,
      },
    ],
  },
  server: { port: 5175, open: false },
  build: { outDir: fileURLToPath(new URL('./dist', import.meta.url)), emptyOutDir: true },
})
