import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * IIFE(브라우저 <script>) 빌드 — react/react-dom/@mediadesk/sdk 를 인라인해 비-React
 * 사이트도 단일 파일로 업로더·갤러리를 띄울 수 있게 한다. window.MediaDesk = { mountUploader,
 * mountGallery, init, createClient }.
 */
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // tsup 산출물(dist/*.js)을 지우지 않도록
    lib: {
      entry: resolve(import.meta.dirname, 'src/iife.ts'),
      name: 'MediaDesk',
      formats: ['iife'],
      fileName: () => 'media-widget.js',
    },
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        extend: true, // window.MediaDesk 에 named export 를 펼침
        exports: 'named',
      },
    },
  },
})
