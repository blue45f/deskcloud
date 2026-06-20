import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
export default defineConfig({
  plugins: [react(), babel({ presets: [reactCompilerPreset()] }), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // @heejun/deskcloud 는 socket.io-client 를 optional 하게 동적 import(try/catch) 한다.
  // socket.io-client 가 없으면 dev 의 esbuild 사전 번들이 그 bare import 해소에 실패하므로
  // 사전 번들에서 제외해 런타임 동적 import(실패 시 catch)로 넘긴다. 프로덕션 빌드엔 영향 없음.
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
