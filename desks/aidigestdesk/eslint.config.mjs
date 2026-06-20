import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

// AIDigestDesk pnpm 모노레포 flat config. 공유 @heejun/eslint-config(TS + import
// 위생 + React 19/RC + jsx-a11y + 커스텀 규칙 + prettier 충돌 비활성)를 단일 lint
// 소스로 채택하고, 이 레포 레이아웃에 맞는 오버라이드만 위에 얹는다. 포매팅은
// package.json prettier + format:check 가 담당하고, 이 설정은 정확성/품질만 강제한다.
//
// 레이아웃: apps/web(React 19 + Vite SPA) + packages/content(tsup 빌드, 순수 데이터/
// 유틸). NestJS(apps/api), packages/shared, 그리고 app/domains/shared/infrastructure
// 4계층 구조가 없으므로 apps/api 블록과 boundaries() 는 의도적으로 생략한다.
export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/.vercel/**',
    '**/*.d.ts',
    '**/*.tsbuildinfo',
    '**/*.config.{js,mjs,cjs,ts}',
    // 단일 파일로 벤더링된 위젯 — 설계상 react-compiler/jsx-a11y 를 위반한다.
    // 위젯 소스는 고치지 않고 lint 대상에서 제외한다.
    '**/apps-vendor/**',
    'apps/toss/**',
  ]),

  // 공유 베이스(TS + import 위생 + 커스텀 규칙 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // apps/web — React 19 + Vite + RC + jsx-a11y.
  react({ files: ['apps/web/**/*.{ts,tsx}'] }),

  // heejun 개인 테스트/목 컨벤션 규칙은 비활성 — 횡단 일관성 대상이 아니라
  // 이 레포 자체 테스트 스타일과 충돌한다(shared base 의 일반 규칙만 채택).
  {
    plugins: { '@heejun': plugin },
    rules: {
      '@heejun/vitest-mock-import': 'off',
      '@heejun/vitest-mock-import-original': 'off',
      '@heejun/mock-response-naming': 'off',
      '@heejun/no-js-interface-direct-access': 'off',
    },
  },

  // packages/content — framework-agnostic (Node). 빌드 스크립트가 node API 사용.
  {
    files: ['packages/content/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // 테스트 — Vitest globals; fast-refresh 제약 완화.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.vitest } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
    },
  }
)
