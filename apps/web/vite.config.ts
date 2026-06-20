import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
//
// PWA(vite-plugin-pwa@1, Vite 8) — SurveyDesk 대시보드를 설치 가능 + 오프라인 앱셸로 만든다.
// desk-platform/apps/web 의 표준 레퍼런스를 그대로 따른다. 핵심 결정:
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고
//     새 빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — react-router 라우트가 오프라인에서도
//     앱셸로 폴백되게(단, /api 프록시 경로는 denylist 로 제외).
//   - 매니페스트 색상은 favicon.svg/styles 토큰을 sRGB 로 변환한 잉크(#16140f)·골드(#e6b873).
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
        name: 'SurveyDesk — 임베드 설문·피드백 수집',
        short_name: 'SurveyDesk',
        description:
          'SurveyDesk — 멀티테넌트(appId) 설문·피드백 수집 SaaS. 별점·NPS·객관식·자유서술을 임베드 위젯으로 모으고, 운영자는 평균·NPS·선택지 분포로 집계를 본다.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 잉크(#16140f)=아이콘 배경과 동일 → splash 가 끊김 없이 이어짐. (favicon.svg, theme-color meta)
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
    port: 5290,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4090',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5290 },
})
