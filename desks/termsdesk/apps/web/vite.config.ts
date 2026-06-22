import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const basePath = process.env.VITE_TERMSDESK_BASE_PATH ?? process.env.VITE_BASE_PATH ?? '/'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
export default defineConfig({
  base: basePath,
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @heejun/deskcloud 는 socket.io-client 를 optional 동적 import 한다.
  // 앱은 실시간 알림용으로 socket.io-client 를 직접 사용하지만 deskcloud 의 동적 경로는 제외 유지.
  optimizeDeps: { exclude: ['@heejun/deskcloud'] },
  server: {
    port: 5270,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4070',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5270 },
})
