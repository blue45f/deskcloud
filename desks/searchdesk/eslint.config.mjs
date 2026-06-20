import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

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
    // 단일 파일 벤더링 위젯(형제 앱 복붙용). react-compiler/jsx-a11y 를 의도적으로
    // 만족하지 않는 캐노니컬 카피라 린트 대상에서 제외한다(위젯 소스를 고치지 않는다).
    '**/apps-vendor/**',
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

  // apps/web 레포 정책: 네이티브 confirm/alert/prompt 금지.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'useConfirm()/ConfirmDialog를 사용하세요 (globalThis.confirm 금지).' },
        { name: 'alert', message: 'Toast/Dialog를 사용하세요 (globalThis.alert 금지).' },
        { name: 'prompt', message: 'usePrompt()/PromptDialog를 사용하세요 (globalThis.prompt 금지).' },
      ],
      // 오버레이(Dialog/CommandPalette)는 열릴 때 주 컨트롤로 포커스를 옮기는 것이
      // 올바른 모달 접근성 동작이라 autoFocus 를 의도적으로 사용한다.
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // 라우트 테이블은 lazy 컴포넌트 + router export 혼재.
  {
    files: ['apps/web/src/router/index.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // 디자인 시스템 프리미티브(shadcn 관용): Radix 프리미티브 재노출(export const Dialog =
  // DialogPrimitive.Root 등)을 스타일드 래퍼와 한 파일에 의도적으로 코로케이트한다.
  // 이 재노출은 사실상 컴포넌트지만 react-refresh 가 정적으로 컴포넌트임을 판별하지 못해
  // 오탐한다. 키트를 쪼개는 것은 이 관용을 거스르므로 components/ui 한정으로만 비활성화한다.
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
    files: ['packages/{shared,sdk}/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.node },
  },

  // packages/widget — 임베드 검색 위젯(React + 바닐라 로더, 브라우저 런타임).
  // react() 는 apps/web 전용이라 위젯은 base 만 받는다. 위젯 소스는 DOM/Keyboard 등
  // 브라우저 전역을 직접 쓰므로 browser globals 를 부여한다(IIFE 로더 포함).
  {
    files: ['packages/widget/**/*.{ts,tsx}'],
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
