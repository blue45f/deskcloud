import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

// 테스트 전용 설정 — 빌드(vite.config.ts)와 분리한다. PWA/babel 플러그인 없이
// React + jsdom 만 켜서 컴포넌트 렌더 테스트를 빠르게 돌린다.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
