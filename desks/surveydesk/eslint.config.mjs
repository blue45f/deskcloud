import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

// SurveyDesk pnpm monorepo flat config. Adopts the shared @heejun/eslint-config
// (TS + import 위생 + React 19/RC + jsx-a11y + 커스텀 규칙 + prettier 충돌 비활성)
// as the single source of lint rules, then layers only the repo-specific
// overrides on top. Prettier owns formatting via `format:check`; this config
// enforces correctness/quality only.
//
// 계층 경계(boundaries)는 적용하지 않는다 — apps/web 은 app/components/hooks/
// pages/router/services/utils 의 평면 구조이고 domains/infrastructure 4계층이
// 없어서 강제할 경계가 없다(없는 계층을 발명하지 않는다).
export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.tsbuildinfo',
    '**/*.config.{js,mjs,cjs,ts}',
    // drizzle-kit 이 향후 생성하는 SQL 마이그레이션 산출물(런타임 마이그레이터인
    // src/db/migrations.ts 는 실제 소스라 린트 대상).
    'apps/api/src/db/migrations/**',
    // 단일 파일 벤더링 위젯 — 형제 앱 복붙용 표준본. react-compiler/jsx-a11y 를
    // 의도적으로 우회하는 설계라 ignore 한다(위젯 소스는 수정하지 않는다).
    '**/apps-vendor/**',
  ]),

  // 공유 베이스(TS + import 위생 + 커스텀 규칙 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // React — apps/web 대시보드 + packages/widget(임베드 React 컴포넌트 lib).
  // 둘 다 React 19 + RC + jsx-a11y 대상.
  react({ files: ['apps/web/**/*.{ts,tsx}', 'packages/widget/**/*.{ts,tsx}'] }),

  // heejun 개인 테스트/목 컨벤션 규칙은 비활성 — 횡단 일관성 대상이 아니라
  // SurveyDesk 자체 테스트 스타일과 충돌한다(shared base 의 일반 규칙만 채택).
  {
    plugins: { '@heejun': plugin },
    rules: {
      '@heejun/vitest-mock-import': 'off',
      '@heejun/vitest-mock-import-original': 'off',
      '@heejun/mock-response-naming': 'off',
      '@heejun/no-js-interface-direct-access': 'off',
    },
  },

  // apps/web 레포 정책: 네이티브 confirm/alert/prompt 금지.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: '브랜드 확인 다이얼로그를 사용하세요 (globalThis.confirm 금지).' },
        { name: 'alert', message: 'Toast/Dialog를 사용하세요 (globalThis.alert 금지).' },
        { name: 'prompt', message: '입력 다이얼로그/폼을 사용하세요 (globalThis.prompt 금지).' },
      ],
    },
  },

  // 라우트 테이블은 lazy 컴포넌트 + router export 혼재.
  {
    files: ['apps/web/src/router/index.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // shadcn 스타일 UI 프리미티브 배럴 — Radix 컴포넌트 참조(예:
  // `export const Dialog = DialogPrimitive.Root`)와 래퍼 컴포넌트를 같은 파일에서
  // 내보내는 정형 패턴이다. ESLint 가 이 재export 를 컴포넌트로 정적 분류하지 못해
  // fast-refresh 규칙이 오탐하므로 이 디렉토리에서만 비활성한다.
  {
    files: ['apps/web/src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // packages/widget/demo — Vite 데모 진입점(인라인 컴포넌트 + createRoot). 앱 엔트리와
  // 동일하게 fast-refresh 계약이 없다.
  {
    files: ['packages/widget/demo/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // apps/api — NestJS (Node). 데코레이터 + 빈 생성자/클래스 관용.
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  // packages/shared — framework-agnostic (Node).
  {
    files: ['packages/shared/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // packages/widget vanilla/iife 로더는 Node 빌드 + 브라우저 런타임 양쪽을 다룬다.
  {
    files: ['packages/widget/src/{iife,vanilla,client,styles}.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
  },

  // 테스트 — Vitest globals; fast-refresh 제약 완화.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': 'off',
    },
  }
)
