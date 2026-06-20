import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

// CommunityDesk pnpm monorepo flat config. Adopts the shared
// @heejun/eslint-config (TS + import 위생 + React 19/RC + jsx-a11y + 커스텀
// 규칙 + prettier 충돌 비활성) as the single source of lint rules, then layers
// only the repo-specific overrides on top. Prettier owns formatting via the
// package.json "prettier" field + the `format:check` step; this config enforces
// correctness/quality only.
//
// boundaries()는 의도적으로 생략한다 — apps/web 은 app/domains/shared/infrastructure
// 4계층 구조가 아니라 app/components/hooks/pages/router/services/styles/utils 평면
// 구조라, 존재하지 않는 계층을 강제하지 않는다.
export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.config.*',
    // apps-vendor 는 호스트 앱에 복붙하는 단일 파일 벤더 위젯(의존성 react만)이라
    // react-compiler/jsx-a11y 를 설계상 만족하지 못한다. 위젯 원본은 손대지 않고 무시한다.
    '**/apps-vendor/**',
  ]),

  // 공유 베이스(TS + import 위생 + 커스텀 규칙 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // apps/web — React 19 + RC + jsx-a11y.
  react({ files: ['apps/web/**/*.{ts,tsx}'] }),

  // packages/widget — apps-vendor 의 단일 파일 위젯과 동일한 자급식(self-contained)
  // React 위젯 소스다. react-compiler/jsx-a11y/set-state-in-effect 를 설계상 만족하지
  // 못한다(인라인 스타일·autoFocus·effect 내 fetch). 위젯 소스는 손대지 않는 것이
  // 원칙이므로, React 플러그인은 로드해 두되(파일 내 react-hooks 디렉티브가 해석되도록)
  // 설계상 위배되는 React 전용 규칙만 끈다. TS/import 위생은 base 로 계속 강제한다.
  react({ files: ['packages/widget/**/*.{ts,tsx}'] }),
  {
    files: ['packages/widget/**/*.{ts,tsx}'],
    rules: {
      'react-compiler/react-compiler': 'off',
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-refresh/only-export-components': 'off',
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // heejun 개인 테스트/목 컨벤션 규칙은 비활성 — 횡단 일관성 대상이 아니라
  // CommunityDesk 자체 테스트 스타일과 충돌한다(shared base 의 일반 규칙만 채택).
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
      // 오버레이(Dialog)는 열릴 때 주 컨트롤(폼 첫 입력)로 포커스를 옮기는 것이 올바른
      // 모달 접근성 동작이고, 전용 인증 페이지도 첫 필드 autoFocus 가 관용이라 의도적으로
      // 사용한다(offhours 와 동일 정책).
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // 라우트 테이블은 lazy 컴포넌트 + router export 혼재.
  {
    files: ['apps/web/src/router/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // components/ui 는 shadcn 류 leaf 프리미티브 배럴이라 Radix 컴포넌트 재export
  // (`export const Tabs = TabsPrimitive.Root`)와 props 인터페이스를 함께 내보낸다.
  // fast-refresh 가 member-expression 재export 를 컴포넌트로 인식하지 못해 오탐하는데,
  // 이 파일들은 상태 없는 프리미티브라 fast-refresh 대상이 아니다.
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

  // packages/** — framework-agnostic 라이브러리(Node 빌드 컨텍스트).
  {
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.node },
  },

  // 테스트 — Vitest globals; fast-refresh 제약 완화.
  {
    files: ['**/*.{test,spec}.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser, ...globals.vitest } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'react-hooks/rules-of-hooks': 'off',
      'react-refresh/only-export-components': 'off',
    },
  }
)
