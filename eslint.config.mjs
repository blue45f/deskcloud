import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/.data/**',
    '**/drizzle/**',
    '**/*.d.ts',
    '**/*.tsbuildinfo',
    '**/*.config.{js,mjs,cjs,ts}',
    // 단일 파일로 벤더링된 위젯 — 설계상 react-compiler/jsx-a11y 를 위반한다.
    // 위젯 원본은 손대지 않고 린트 대상에서 제외한다.
    '**/apps-vendor/**',
    'apps/api/src/db/migrations/**',
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

  // apps/web 레포 정책.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      // 오버레이(Dialog)와 진입 폼은 마운트 시 주 컨트롤로 포커스를 옮기는 것이
      // 올바른 모달/폼 접근성 동작이라 autoFocus 를 의도적으로 사용한다.
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // 디자인 시스템 프리미티브 — Radix 파트를 별칭 const 로 재노출하는 shadcn 패턴
  // (export const Dialog = DialogPrimitive.Root 등). react-refresh 는 별칭 재노출을
  // 컴포넌트로 정적 판별하지 못해 오탐하므로 이 래퍼 파일에 한해 비활성.
  {
    files: ['apps/web/src/components/ui/**/*.{ts,tsx}'],
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

  // packages/shared, packages/sdk — isomorphic (Node).
  {
    files: ['packages/shared/**/*.ts', 'packages/sdk/**/*.ts'],
    languageOptions: { globals: globals.node },
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
