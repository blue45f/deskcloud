import { base, react, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/.vercel/**',
    '**/.vite/**',
    '**/.data/**',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/node_modules/**',
    '**/drizzle/**',
    'apps/api/src/db/migrations/**',
    '**/*.config.{js,cjs,mjs,ts}',
    '**/vite.config.ts',
  ]),

  // 공유 베이스(TS + import 위생 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // React 19 + RC + jsx-a11y — web 앱 + sdk 의 React 진입점(react.tsx).
  react({ files: ['apps/web/**/*.{ts,tsx}', 'packages/sdk/**/*.tsx'] }),

  // Node 환경 (api · shared · sdk · 루트 Vercel 프록시 · cjs/mjs · scripts).
  {
    files: [
      'apps/api/**/*.ts',
      'packages/**/*.ts',
      'api/**/*.ts',
      '**/*.{cjs,mjs}',
      '**/scripts/**',
    ],
    languageOptions: { globals: { ...globals.node } },
  },

  // NestJS (apps/api): DI + emitDecoratorMetadata 는 값 import 가 필요 →
  // consistent-type-imports 비활성(--fix 가 주입 클래스를 import type 으로 바꾸면 런타임 DI 가 깨짐).
  // 데코레이터 + 빈 생성자/클래스 관용도 함께 허용.
  {
    files: ['apps/api/**/*.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  // 하우스 규칙(web): 네이티브 다이얼로그 금지 — useConfirm()/ConfirmDialog/toast 사용.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: {
      // jsx-a11y 가 커스텀 폼 컨트롤(field.tsx 의 Input/Select/Textarea/Checkbox)을
      // 네이티브 컨트롤로 인식하도록 등록 → <label>{children}</label> 래핑이 올바르게
      // "연관됨"으로 판정된다(label-has-associated-control 의 가짜 양성 제거).
      'jsx-a11y': {
        components: { Input: 'input', Select: 'select', Textarea: 'textarea', Checkbox: 'input' },
      },
    },
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'globalThis.confirm 금지 — useConfirm()/ConfirmDialog 사용' },
        { name: 'alert', message: 'globalThis.alert 금지 — toast/Dialog 사용' },
        { name: 'prompt', message: 'globalThis.prompt 금지 — 입력 Dialog 사용' },
      ],
      // exhaustive-deps 는 기존 정책대로 error 유지(react() 의 recommended 는 warn).
      'react-hooks/exhaustive-deps': 'error',
      // 오버레이/모달(Dialog·Confirm) 진입 시 주 컨트롤로 포커스를 옮기는 것은
      // 올바른 모달 접근성 동작 → no-autofocus 는 web 에서 의도적으로 비활성.
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // jsx-a11y label 매칭은 web 글로벌이지만 커스텀 컨트롤 설정은 settings 로만 전파되므로
  // controlComponents 도 함께 명시(룰 옵션 경로 — 일부 버전에서 settings 와 별개로 본다).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/label-has-associated-control': [
        'error',
        // controlComponents: 커스텀 폼 컨트롤을 네이티브로 인식.
        // depth 3: 라벨 텍스트가 <label><span><span>{text} 처럼 중첩된 경우까지 탐색.
        // assert either: htmlFor(id 연관) 또는 중첩 컨트롤 둘 중 하나면 통과.
        {
          controlComponents: ['Input', 'Select', 'Textarea', 'Checkbox'],
          assert: 'either',
          depth: 3,
        },
      ],
    },
  },

  // shadcn 스타일 UI 프리미티브 배럴: Radix 컴포넌트를 const 로 재노출하므로
  // react-refresh 가 컴포넌트/비컴포넌트를 정적으로 구분하지 못한다(가짜 양성).
  // 프리미티브 파일은 fast-refresh 단위가 아니므로 only-export-components 비활성.
  {
    files: ['apps/web/src/components/ui/**/*.tsx', 'apps/web/src/router/index.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // packages/sdk: 퍼블리시되는 라이브러리(브라우저 fast-refresh 컨텍스트 아님).
  // react-compiler 게이트는 유지하되 fast-refresh 제약은 의미가 없어 비활성.
  {
    files: ['packages/sdk/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // React Compiler 진단(react-hooks@7 recommended 신규 규칙군)은 이번 설정 채택 범위 밖이며
  // 런타임 동작 리팩터링을 요구한다(예: ThemeProvider 의 파생상태 동기화, content_hash/
  // append-only 불변식에 영향 가능). 기존 config 가 강제하던 rules-of-hooks·exhaustive-deps
  // 패리티는 유지하고, 신규 컴파일러 진단만 비활성 — 후속 PR 에서 점진 도입한다.
  {
    files: ['apps/web/**/*.{ts,tsx}', 'packages/sdk/**/*.{ts,tsx}'],
    rules: {
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
      'react-hooks/incompatible-library': 'off',
    },
  }
)
