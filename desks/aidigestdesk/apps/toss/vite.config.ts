import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 브라우저 프리뷰 빌드(PREVIEW_NO_TDS=1)에서는 TDS를 대체 컴포넌트로 alias 해요.
// @toss/tds-mobile은 앱인토스 밖에서 런타임 가드로 예외를 던져 일반 브라우저 마운트를 막거든요.
// 실제 앱인토스(.ait) 빌드에는 영향이 없어요(env 미설정 시 alias 비활성).
const previewNoTds = process.env.PREVIEW_NO_TDS === '1';
const tdsShim = fileURLToPath(new URL('./src/tds-shim.tsx', import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  // React Compiler(babel-plugin-react-compiler) — React 19 컴포넌트 자동 메모이즈.
  // plugin-react 의 babel.plugins 경로로 주입(형제 desk-platform 표준과 동일, 런타임 폴리필 불필요).
  plugins: [react({ babel: { plugins: [['babel-plugin-react-compiler', {}]] } })],
  // shamefully-hoist 모노레포에서 web 과 toss 의 React(둘 다 19)가 섞이지 않도록
  // 이 앱의 React 단일 인스턴스로 강제 정렬해요. (invalid hook 방지)
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: previewNoTds ? { '@toss/tds-mobile-ait': tdsShim, '@toss/tds-mobile': tdsShim } : {},
  },
});
