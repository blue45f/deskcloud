import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
//
// PWA(vite-plugin-pwa@1, Vite 8 호환) — ChatDesk 대시보드를 설치 가능 + 오프라인 앱셸로 만든다.
// desk-platform/apps/web 의 표준 레퍼런스를 따른다. 핵심 결정:
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고
//     새 빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — SPA 라우트(react-router) 가 오프라인에서도
//     앱셸로 폴백되게(단, /api·/chat 프록시 경로는 denylist 로 제외).
//   - 매니페스트 색상은 styles/index.css 의 oklch 토큰을 sRGB 로 변환한 값(매니페스트는
//     oklch 미지원). 잉크(#16140f)로 splash/테마를 아이콘 배경과 일치시킨다.
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
        // 단, API REST(/api/*)·실시간 소켓(/chat/*)은 앱셸로 폴백하면 안 되므로 제외.
        navigateFallbackDenylist: [/^\/api\//, /^\/chat\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'ChatDesk — 임베드 메시징 인프라',
        short_name: 'ChatDesk',
        description:
          'ChatDesk — 멀티테넌트 메시징(1:1 쪽지 DM + 그룹/룸 채팅) as a service. 한 줄 임베드로 실시간 메시징을 붙이고 대화·사용량을 모니터한다.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 잉크(#16140f)=아이콘 배경과 동일 → splash 가 끊김 없이 이어짐. (styles/index.css --color-ink)
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
    port: 5294,
    proxy: {
      // 어드민 REST 와 실시간 소켓(/chat)을 같은 오리진처럼 프록시한다(dev).
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4094',
        changeOrigin: true,
      },
      '/chat': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4094',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  preview: { port: 5294 },
})
