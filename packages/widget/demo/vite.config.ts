import { resolve } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 위젯 데모(vite). 로컬 API(기본 :4096)에 붙어 데모 게시판(pk_demo)을 띄운다.
 * 실행: pnpm --filter @communitydesk/widget run dev:demo  (FREE 하이포트 5289)
 *
 * @communitydesk/sdk·shared 는 워크스페이스 dist 를 쓰지 않고 소스로 바로 가리켜
 * 빌드 산출물 없이도 데모가 동작하게 한다(콜드스타트 편의).
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  resolve: {
    alias: {
      '@communitydesk/sdk/browser': resolve(import.meta.dirname, '../../sdk/src/browser.ts'),
      '@communitydesk/sdk/admin': resolve(import.meta.dirname, '../../sdk/src/admin.ts'),
      '@communitydesk/sdk': resolve(import.meta.dirname, '../../sdk/src/index.ts'),
      '@communitydesk/shared': resolve(import.meta.dirname, '../../shared/src/index.ts'),
    },
  },
  server: { port: 5289, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true },
})
