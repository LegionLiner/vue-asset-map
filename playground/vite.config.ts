import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  resolve: {
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
