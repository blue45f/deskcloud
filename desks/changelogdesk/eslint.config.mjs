import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

// ChangelogDesk pnpm 모노레포 flat config. 공유 @heejun/eslint-config
// (TS + import 위생 + React 19/RC + jsx-a11y + 커스텀 규칙 + prettier 충돌
// 비활성)를 단일 lint 규칙 소스로 채택하고, 레포 고유 오버라이드만 위에 얹는다.
// 포매팅은 package.json prettier 필드 + `format:check`가 담당하고, 이 config 는
// 정합성/품질만 강제한다.
//
// 레이아웃: apps/web(React+Vite 대시보드) · apps/api(NestJS+Drizzle) ·
// packages/shared(zod 계약·순수 유틸) · packages/widget(임베드 위젯, React lib +
// 바닐라 IIFE 로더). apps/web 은 app/components/pages/... 평면 구조라
// app/domains/shared/infrastructure 4계층이 없어 boundaries() 는 도입하지 않는다.
export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.config.*',
    // 단일 파일 벤더링 위젯(복붙 배포본) — react-compiler/jsx-a11y 를 설계상
    // 만족하지 못하므로 무시한다. 위젯 소스는 packages/widget 이 정본.
    '**/apps-vendor/**',
  ]),

  // 공유 베이스(TS + import 위생 + 커스텀 규칙 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // apps/web — React 19 + Vite + RC + jsx-a11y.
  react({ files: ['apps/web/**/*.{ts,tsx}'] }),
  // packages/widget — React 컴포넌트 위젯(react.tsx/icons.tsx 등). 동일 React 규칙.
  react({ files: ['packages/widget/**/*.{ts,tsx}'] }),

  // heejun 개인 테스트/목 컨벤션 규칙은 비활성 — 횡단 일관성 대상이 아니라
  // ChangelogDesk 자체 테스트 스타일과 충돌한다(shared base 의 일반 규칙만 채택).
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
      // 다이얼로그/로그인·가입 폼은 열릴 때 첫 입력으로 포커스를 옮기는 것이 올바른
      // 모달·폼 접근성 동작이라 autoFocus 를 의도적으로 사용한다(offhours 동일 정책).
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // apps/web 라우트 테이블은 lazy 컴포넌트 + router export 혼재.
  {
    files: ['apps/web/src/router/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // 디자인 시스템 프리미티브(components/ui) — Radix 프리미티브 별칭 재노출
  // (예: `export const Dialog = DialogPrimitive.Root`)을 컴포넌트와 한 모듈에서
  // 함께 내보내는 shadcn 스타일 래퍼. react-refresh 가 재노출 별칭을 컴포넌트로
  // 정적 판별하지 못해 생기는 오탐이라(정합성 문제 아님) 이 폴더만 끈다.
  {
    files: ['apps/web/src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // packages/widget — 위젯 패키지는 React 컴포넌트와 mount()/loader 등 비컴포넌트
  // export 를 같은 모듈에서 내보내는 라이브러리(react.tsx/index.ts/vanilla.ts).
  // fast-refresh 계약 대상이 아니므로 only-export-components 를 끄고, IIFE/바닐라
  // 로더(iife.ts/vanilla.ts)는 window/document 등 브라우저 전역을 사용한다.
  {
    files: ['packages/widget/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser } },
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
