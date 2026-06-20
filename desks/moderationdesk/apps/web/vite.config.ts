import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
//
// PWA(vite-plugin-pwa@1, Vite 8) — ModerationDesk 대시보드를 설치 가능 + 오프라인 앱셸로 만든다.
// 형제 desk-platform 레퍼런스와 동일한 결정:
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고 새 빌드가
//     뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — react-router 라우트가 오프라인에서도 앱셸로 폴백되게
//     (단, /api 프록시 경로는 denylist 로 제외 — 앱셸로 폴백하면 안 됨).
//   - 매니페스트 색상은 styles/index.css 의 oklch 토큰을 sRGB 로 변환한 값(매니페스트는 oklch 미지원).
//     잉크(#1a1410)로 splash/테마를 아이콘 배경과 일치, 크림슨(#cf4040)을 theme_color 로.
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
      // public/ 에 이미 있는 정적 에셋(favicon·apple-touch)을 프리캐시 목록에 포함.
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
        name: 'ModerationDesk',
        short_name: 'ModerationDesk',
        description:
          'ModerationDesk — 멀티테넌트 콘텐츠 모더레이션 SaaS. publishable 키로 텍스트를 검사·신고하고, secret 키로 금칙 규칙·신고·로그를 관리합니다. 규칙 기반은 항상, Claude AI 보조는 선택.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 잉크(#1a1410)=아이콘 배경과 동일 → splash 가 끊김 없이 이어짐. 크림슨(#cf4040)=강조 테마.
        background_color: '#1a1410',
        theme_color: '#cf4040',
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
    port: 5292,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4092',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5292 },
})
