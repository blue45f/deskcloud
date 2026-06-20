import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * 위젯 데모(vite). 로컬 API(기본 :4093)에 붙어 데모 테넌트(pk_demo)로 검색한다.
 * 실행: pnpm --filter @searchdesk/widget run dev:demo  (FREE 하이포트 5296 사용)
 */
export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  server: { port: 5296, host: '127.0.0.1' },
  build: { outDir: 'dist', emptyOutDir: true },
})
