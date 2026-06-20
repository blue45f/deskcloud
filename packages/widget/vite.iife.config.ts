import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * IIFE(브라우저 <script>) 빌드 — react/react-dom/@chatdesk/sdk(socket.io-client 포함)를
 * 인라인해 비-React 사이트도 단일 파일로 채팅 위젯을 띄울 수 있게 한다.
 * window.ChatDesk = { mount, init }.
 *
 * @chatdesk/sdk·@chatdesk/shared 는 런타임 값을 import 하므로 번들에 포함된다(external 아님).
 */
export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  resolve: {
    alias: [
      // @chatdesk/shared 의 keys.ts 가 node:crypto 를 import 하지만, 위젯/SDK 브라우저
      // 코드는 그 키 생성/해시 함수를 쓰지 않는다(상수·타입만). 트리셰이킹으로 제거되지만,
      // import 그래프 분석 단계의 "crypto externalized" 경고를 없애려 빈 스텁으로 별칭한다.
      { find: /^node:crypto$/, replacement: resolve(import.meta.dirname, 'src/empty-crypto.ts') },
      { find: /^crypto$/, replacement: resolve(import.meta.dirname, 'src/empty-crypto.ts') },
    ],
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false, // tsup 산출물(dist/*.js)을 지우지 않도록
    lib: {
      entry: resolve(import.meta.dirname, 'src/iife.ts'),
      name: 'ChatDesk',
      formats: ['iife'],
      fileName: () => 'chat-widget.js',
    },
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {
      output: {
        extend: true, // window.ChatDesk 에 named export 를 펼침
        exports: 'named',
      },
    },
  },
})
