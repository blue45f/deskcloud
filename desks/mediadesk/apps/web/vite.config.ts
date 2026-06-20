import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// React Compiler (포트폴리오 표준): @vitejs/plugin-react + @rolldown/plugin-babel reactCompilerPreset().
//
// PWA(vite-plugin-pwa@1, Vite 8 호환) — MediaDesk 대시보드를 설치 가능 + 오프라인 앱셸로
// 만든다. desk-platform/apps/web 의 VitePWA 블록을 이 앱(React Compiler/Vite 8)에 맞춰 적용한
// 독립 플러그인 엔트리다(위 react/RC/tailwind 배선은 건드리지 않는다). 핵심 결정:
//   - registerType:'autoUpdate' + injectRegister:'auto' — SW 등록 코드를 자동 주입하고 새
//     빌드가 뜨면 사용자 개입 없이 갱신(앱셸형 SPA 에 적합).
//   - workbox.navigateFallback:'/index.html' — react-router SPA 라우트가 오프라인에서도
//     앱셸로 폴백되게(단 /api·/file 프록시 경로는 denylist 로 제외 — 자산/업로드 응답을
//     앱셸 HTML 로 가로채면 안 됨).
//   - 매니페스트 색상은 잉크(#101826)=favicon 배경·index.html theme-color 와 동일.
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
      // public/ 의 정적 에셋(직접 생성한 SVG·apple-touch PNG)을 프리캐시 목록에 포함.
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      workbox: {
        // 빌드 산출물(JS/CSS/HTML/이미지/폰트)을 프리캐시.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // SPA 앱셸 폴백 — 오프라인에서도 라우트가 index.html 로 해석되게.
        navigateFallback: '/index.html',
        // 단, API(/api/*)·자산 서빙(/file/*) 프록시는 앱셸로 폴백하면 안 되므로 제외.
        navigateFallbackDenylist: [/^\/api\//, /^\/file\//],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: 'MediaDesk — 업로드·변환·CDN as a Service',
        short_name: 'MediaDesk',
        description:
          '멀티테넌트 미디어 업로드·변환·CDN SaaS. 한 줄 임베드 업로더·갤러리, 온더플라이 이미지 변환(리사이즈·포맷·품질), 테넌트별 키·CORS·사용량.',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // 잉크(#101826)=favicon 배경·index.html theme-color 와 동일 → splash 가 끊김 없이 이어짐.
        background_color: '#101826',
        theme_color: '#101826',
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
    port: 5291,
    proxy: {
      '/api': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4191',
        changeOrigin: true,
      },
      // 공개 자산·파일 서빙도 dev 프록시로 통과(같은 origin 으로 위젯/갤러리 동작).
      '/file': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:4191',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 5291 },
})
