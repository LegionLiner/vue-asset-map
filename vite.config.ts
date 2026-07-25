import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.build.json',
      entryRoot: 'src',
      include: ['src/**/*.ts', 'src/**/*.vue'],
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
        assetFileNames: (asset) => {
          const names = asset.names ?? (asset.name ? [asset.name] : [])
          return names.some((name) => name.endsWith('.css')) ? 'style.css' : '[name][extname]'
        },
      },
    },
  },
})
