import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

// desk-platform pnpm monorepo flat config. Adopts the shared
// @heejun/eslint-config (TS + import 위생 + React 19/RC + jsx-a11y + 커스텀
// 규칙 + prettier 충돌 비활성) as the single source of lint rules, then layers
// only the repo-specific overrides on top. Prettier owns formatting via the
// package.json "prettier"(@heejun/prettier-config) 미사용 — format:check 단계;
// this config enforces correctness/quality only.
export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.tsbuildinfo',
    '**/*.config.{js,mjs,cjs,ts}',
    // 단일파일로 벤더링된 zero-dep 위젯(Powered by DeskCloud 배지·plan-limits 맵).
    // 어떤 Desk 에도 copy-paste 되도록 의도적으로 외부의존·전역 JSX 네임스페이스를
    // 쓰므로 react-compiler/jsx-a11y 를 design 상 위반한다 — 소스를 고치지 말고 무시.
    '**/apps-vendor/**',
    '**/vendor/**',
  ]),

  // 공유 베이스(TS + import 위생 + 커스텀 규칙 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // apps/web — React 19 + Vite + RC + jsx-a11y.
  react({ files: ['apps/web/**/*.{ts,tsx}'] }),

  // Radix 래퍼 프리미티브는 shadcn 관용대로 원시 루트를 별칭 재export 한다
  // (export const Dialog = DialogPrimitive.Root 등). 이들은 실제 컴포넌트지만
  // 린터가 멤버 표현식을 컴포넌트로 분류하지 못해 only-export-components 가
  // 오탐한다. HMR 전용(DX) 규칙이므로 해당 프리미티브 파일에 한해 끈다.
  {
    files: [
      'apps/web/src/components/ui/dialog.tsx',
      'apps/web/src/components/ui/tabs.tsx',
      'apps/web/src/components/ui/tooltip.tsx',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // heejun 개인 테스트/목 컨벤션 규칙은 비활성 — 횡단 일관성 대상이 아니라
  // desk-platform 자체 테스트 스타일과 충돌한다(shared base 의 일반 규칙만 채택).
  {
    plugins: { '@heejun': plugin },
    rules: {
      '@heejun/vitest-mock-import': 'off',
      '@heejun/vitest-mock-import-original': 'off',
      '@heejun/mock-response-naming': 'off',
      '@heejun/no-js-interface-direct-access': 'off',
    },
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

  // packages/* — isomorphic 코어/빌링/공유 (Node). billing/core 는 NestJS 얇은
  // 어댑터(가드/프로바이더)도 포함하므로 빈 생성자/클래스도 허용한다.
  {
    files: ['packages/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
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
