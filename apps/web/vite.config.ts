import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// 포트폴리오 내 다른 프로젝트와 겹치지 않도록 6091 사용(피하기: 5173-5174 등).
// /api 는 중앙 빌링/계정 API(:6090, PGlite 폴백)로 프록시한다.
//
// React Compiler(babel-plugin-react-compiler@^1) — React 19 컴포넌트를 자동 메모이즈.
// @vitejs/plugin-react@5(Vite 7)는 reactCompilerPreset 을 export 하지 않으므로 형제
// 레포(plugin-react@6/Vite 8 의 @rolldown/plugin-babel + reactCompilerPreset)와 달리
// 동일 컴파일러를 plugin-react 의 babel.plugins 경로로 주입한다(eslint react-compiler 게이트와 일치).
export default defineConfig({
  plugins: [react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } }), tailwindcss()],
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
