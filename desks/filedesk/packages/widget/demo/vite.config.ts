import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 위젯 데모(vite). 로컬 API(기본 :4100)에 붙어 업로더를 띄운다.
 * 실행: pnpm --filter @filedesk/widget run dev:demo  (FREE 하이포트 5308 사용)
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: { port: 5308, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true },
})
