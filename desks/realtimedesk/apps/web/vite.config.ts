/// <reference types="vitest/config" />
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
//
// PWA(vite-plugin-pwa@1) — RealtimeDesk 대시보드를 설치 가능 + 오프라인 앱셸로 만든다.
// desk-platform/apps/web 의 표준 레퍼런스를 이 앱(Vite 8 + plugin-react 6)에 맞춰 각색했다.
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고
//     새 빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — react-router 라우트가 오프라인에서도 앱셸로
//     폴백되게. 단 /api(REST) 와 /realtime(socket.io 핸드셰이크) 은 denylist 로 제외.
//   - 매니페스트 색상은 styles/index.css 의 oklch 토큰을 sRGB 로 변환한 잉크(#0f1729).
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
        // 단, API(/api/*)·실시간(/realtime/*) 핸드셰이크는 앱셸로 폴백하면 안 되므로 제외.
        navigateFallbackDenylist: [/^\/api\//, /^\/realtime\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'RealtimeDesk — 실시간 pub/sub·presence as a service',
        short_name: 'RealtimeDesk',
        description:
          'RealtimeDesk — 멀티테넌트 실시간(WebSocket pub/sub + presence) as a service. 채널 구독·publish·presence·메시지 히스토리를 키 한 쌍으로. 브라우저는 pk, 서버는 sk.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 잉크(#0f1729)=아이콘 배경과 동일 → splash 가 끊김 없이 이어짐. (favicon.svg / index.html theme-color)
        background_color: '#0f1729',
        theme_color: '#0f1729',
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
  // dev·preview 공통 프록시 — 어드민/공개 REST 는 /api 로, 실시간 socket.io 핸드셰이크는
  // /realtime 으로 API(기본 4092)에 전달한다. changeOrigin 은 끄고 브라우저의 실제 Origin 을
  // 그대로 넘겨, 테넌트별 Origin allowlist 가 의미 있게 동작하도록 한다.
  server: {
    port: 5292,
    proxy: {
      '/api': { target: process.env.VITE_API_BASE_URL || 'http://localhost:4092' },
      '/realtime': { target: process.env.VITE_API_BASE_URL || 'http://localhost:4092', ws: true },
    },
  },
  preview: {
    port: 5292,
    proxy: {
      '/api': { target: process.env.VITE_API_BASE_URL || 'http://localhost:4092' },
      '/realtime': { target: process.env.VITE_API_BASE_URL || 'http://localhost:4092', ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
