/// <reference types="vitest/config" />
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
//
// PWA(vite-plugin-pwa@1) — ReviewDesk 어드민을 설치 가능 + 오프라인 앱셸로 만든다.
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고
//     새 빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — SPA 라우트(react-router) 가 오프라인에서도
//     앱셸로 폴백되게(단, /api 프록시 경로는 denylist 로 제외).
//   - 매니페스트 색상은 favicon.svg/styles 토큰의 잉크(#16140f)·골드(#e6b873).
//   - devOptions.enabled:false — dev 서버에선 SW 비활성(HMR·캐시 혼선 방지).
// 아이콘은 scripts/generate-pwa-icons.mjs 로 public/ 에 사전 래스터라이즈(의존성 0).
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // public/ 에 이미 있는 정적 에셋(직접 생성한 PNG·SVG)을 프리캐시 목록에 포함.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // 빌드 산출물(JS/CSS/HTML/이미지/폰트)을 프리캐시.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA 앱셸 폴백 — 오프라인에서도 라우트가 index.html 로 해석되게.
        navigateFallback: '/index.html',
        // 단, API 프록시(/api/*)는 앱셸로 폴백하면 안 되므로 제외.
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'ReviewDesk — 임베드 평점·리뷰·후기 수집',
        short_name: 'ReviewDesk',
        description:
          'ReviewDesk — 멀티테넌트 평점·리뷰·후기(testimonials) 수집 SaaS. 셀프가입 → 임베드 한 줄 → 별점·리뷰·후기를 받고 검수하고 노출합니다.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 잉크(#16140f)=아이콘 배경과 동일 → splash 가 끊김 없이 이어짐.
        background_color: '#16140f',
        theme_color: '#16140f',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5299,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4099',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5299 },
  // 컴포넌트/페이지 스모크 테스트 — jsdom + Testing Library + jest-dom 매처.
  // setup 파일이 matchMedia/IntersectionObserver(모션·리빌 훅 의존)를 폴리필한다.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
