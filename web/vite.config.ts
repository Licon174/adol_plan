import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: './',
  esbuild: {
    legalComments: 'none',
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2020',
    outDir: '../resources/web',
    emptyOutDir: true,
    cssCodeSplit: false,
    assetsInlineLimit: 8192,
    reportCompressedSize: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
        entryFileNames: 'app.js',
        chunkFileNames: 'app.js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? 'asset'
          if (name.endsWith('.css')) return 'app.css'
          return 'assets/[name][extname]'
        },
      },
    },
  },
  server: {
    port: 5173,

    proxy: {
      '/reqproc': { target: 'http://192.168.0.1', changeOrigin: true },
      '/pic': { target: 'http://192.168.0.1', changeOrigin: true },
    },
  },
})
