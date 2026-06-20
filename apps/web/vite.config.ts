import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// 린(lean) 어드민 — Vite 8 + React 19 + react-router. Tailwind/Radix/react-compiler 없이
// 자체 스코프 CSS 로 가볍게 유지한다(위젯이 주인공). API 는 dev 프록시로 /api 를 4110 에 연결.
//
// PWA(vite-plugin-pwa@1) — AuthDesk 대시보드를 설치 가능 + 오프라인 앱셸로 만든다.
// 핵심 결정(desk-platform 표준 레퍼런스와 동일):
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고
//     새 빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — react-router 라우트가 오프라인에서도
//     앱셸로 폴백되게(단, /api 프록시 경로는 denylist 로 제외).
//   - 매니페스트 색상은 styles/index.css 의 --ad-accent(#2f5fe0)·--ad-bg. 매니페스트는
//     hex 만 받으므로 토큰 값을 그대로 hex 로 쓴다.
//   - devOptions.enabled:false — dev 서버에선 SW 비활성(HMR·캐시 혼선 방지).
// 아이콘은 scripts/generate-pwa-icons.mjs 로 public/ 에 사전 래스터라이즈(의존성 0).
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
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
        name: 'AuthDesk — 임베드 로그인/인증',
        short_name: 'AuthDesk',
        description:
          'AuthDesk — 드롭인 로그인/인증 모듈(auth-as-a-service). publishable 키로 가입·로그인 폼을 임베드하고, secret 키로 사용자·통계를 관리합니다.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 로열블루(#2f5fe0)=아이콘 배경과 동일 → splash 가 끊김 없이 이어짐. (styles/index.css --ad-accent)
        background_color: '#2f5fe0',
        theme_color: '#2f5fe0',
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
    port: 5310,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4110',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5310 },
})
