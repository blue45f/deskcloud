import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// 포트폴리오 내 다른 프로젝트와 겹치지 않도록 6091 사용(피하기: 5173-5174 등).
// /api 는 중앙 빌링/계정 API(:6090, PGlite 폴백)로 프록시한다.
//
// React Compiler(babel-plugin-react-compiler@^1) — React 19 컴포넌트를 자동 메모이즈.
// @vitejs/plugin-react@5(Vite 7)는 reactCompilerPreset 을 export 하지 않으므로 형제
// 레포(plugin-react@6/Vite 8 의 @rolldown/plugin-babel + reactCompilerPreset)와 달리
// 동일 컴파일러를 plugin-react 의 babel.plugins 경로로 주입한다(eslint react-compiler 게이트와 일치).
//
// PWA(vite-plugin-pwa@1) — DeskCloud 포털을 설치 가능 + 오프라인 앱셸로 만든다. 이 블록이
// 형제 Vite 앱이 복사할 **표준 레퍼런스**다. 핵심 결정:
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고
//     새 빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — SPA 라우트(react-router) 가 오프라인에서도
//     앱셸로 폴백되게(단, /api 프록시 경로는 denylist 로 제외).
//   - 매니페스트 색상은 styles/index.css 의 oklch 토큰을 sRGB 로 변환한 값(매니페스트는
//     oklch 미지원). 잉크(#1c1f28)로 splash/테마를 아이콘 배경과 일치시킨다.
//   - devOptions.enabled:false — dev 서버에선 SW 비활성(HMR·캐시 혼선 방지).
// 아이콘은 scripts/generate-pwa-icons.mjs 로 public/ 에 사전 래스터라이즈(의존성 0).
export default defineConfig({
  plugins: [
    react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } }),
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
        name: 'DeskCloud Platform',
        short_name: 'DeskCloud',
        description:
          'DeskCloud — 여러 SaaS를 하나의 계정과 한 줄 임베드로. 약관·설문·리뷰·알림·검색·실시간·커뮤니티 Desk 패밀리의 통합 멀티테넌트 + 빌링 플랫폼.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 잉크(#1c1f28)=아이콘 배경과 동일 → splash 가 끊김 없이 이어짐. (styles/index.css --color-ink)
        background_color: '#1c1f28',
        theme_color: '#1c1f28',
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
