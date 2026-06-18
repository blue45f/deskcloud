import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// 포트폴리오 내 다른 프로젝트와 겹치지 않도록 6091 사용(피하기: 5173-5174 등).
// /api 는 중앙 빌링/계정 API(:6090, PGlite 폴백)로 프록시한다.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 6091,
    strictPort: true,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:6090',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 6091, strictPort: true },
})
