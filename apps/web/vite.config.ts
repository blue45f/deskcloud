import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// 린(lean) 어드민 — Vite 8 + React 19 + react-router. Tailwind/Radix/react-compiler 없이
// 자체 스코프 CSS 로 가볍게 유지한다(위젯이 주인공). API 는 dev 프록시로 /api 를 4096 에 연결.
//
// PWA(vite-plugin-pwa@1) — AdDesk 어드민을 설치 가능 + 오프라인 앱셸로 만든다.
// desk-platform/apps/web 의 표준 레퍼런스를 따른다. 핵심 결정:
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고
//     새 빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — SPA 라우트(react-router) 가 오프라인에서도
//     앱셸로 폴백되게(단, /api 프록시 경로는 denylist 로 제외).
//   - 매니페스트 색상은 styles/index.css 의 --ax-accent(#2f5fe0)·다크 surface(#0e1014).
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
        name: 'AdDesk — 임베드 배너·광고 서빙',
        short_name: 'AdDesk',
        description:
          'AdDesk — 멀티테넌트(pk/sk) 배너·광고 서빙 SaaS. publishable 키로 슬롯에 배너를 띄우고, secret 키로 캠페인·크리에이티브·슬롯·통계(CTR)를 관리합니다.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 다크 surface(#0e1014)=splash 배경, 액센트 블루(#2f5fe0)=아이콘 배경/테마.
        background_color: '#0e1014',
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
    port: 5296,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4096',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5296 },
})
