import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * IIFE(브라우저 <script>) 빌드 — react/react-dom/@communitydesk/sdk 를 인라인해 비-React
 * 사이트도 단일 파일로 게시판 위젯을 띄울 수 있게 한다. window.CommunityDesk = { mount, init }.
 *
 * @communitydesk/sdk·shared 는 런타임 값(클라이언트 팩토리·살균 유틸 미사용이지만 SDK)을
 * 쓰므로 번들에 포함되어야 한다 → external 로 두지 않는다(워크스페이스 소스로 해소).
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
      name: 'CommunityDesk',
      formats: ['iife'],
      fileName: () => 'community-widget.js',
    },
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        extend: true, // window.CommunityDesk 에 named export 를 펼침
        exports: 'named',
      },
    },
  },
})
