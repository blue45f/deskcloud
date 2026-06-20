import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.tsbuildinfo',
    '**/*.config.{js,mjs,cjs,ts}',
    // 단일 파일 벤더링 위젯(형제 앱에 복붙용). react-compiler/jsx-a11y 를 의도적으로
    // 만족하지 않는 캐노니컬 산출물이라 린트 대상에서 제외한다(위젯 소스는 손대지 않음).
    '**/apps-vendor/**',
  ]),

  // 공유 베이스(TS + import 위생 + 커스텀 규칙 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // apps/web — React 19 + Vite + RC + jsx-a11y.
  react({ files: ['apps/web/**/*.{ts,tsx}'] }),

  // apps/web 정책: 단일 목적 인증 폼(로그인 sk · 가입 테넌트명)의 첫 필드와
  // 오버레이(Dialog)는 열릴 때 주 컨트롤로 포커스를 옮기는 것이 올바른 동작이라
  // autoFocus 를 의도적으로 사용한다(offhours 동일 정책).
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: { 'jsx-a11y/no-autofocus': 'off' },
  },

  // components/ui — Radix 프리미티브 래퍼(디자인 시스템). 컴포넌트 별칭(`export const
  // Dialog = DialogPrimitive.Root`)과 타입/상수를 한 파일에 함께 export 하는 shadcn 패턴이라
  // react-refresh 가 컴포넌트 여부를 정적 판별하지 못한다. fast-refresh 로 반복 편집하는
  // 피처 컴포넌트가 아니라 안정적인 프리미티브이므로 이 파일들에 한해 규칙을 끈다.
  {
    files: ['apps/web/src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

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

  // apps/api — NestJS (Node). 데코레이터 + 빈 생성자/클래스 관용.
  {
    files: ['apps/api/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  },

  // packages/shared, packages/sdk — isomorphic/Node 라이브러리.
  {
    files: ['packages/{shared,sdk}/**/*.ts'],
    languageOptions: { globals: globals.node },
  },

  // packages/widget — 임베드 채팅 위젯(브라우저 타깃: document/window 사용).
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
