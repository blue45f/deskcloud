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
    // 단일 파일로 벤더링된 위젯(임베드 스니펫)은 react-compiler/jsx-a11y 를 의도적으로
    // 위반한다(외부 프레임워크 0 + 수동 DOM). 위젯 소스는 고치지 말고 무시한다.
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

  // apps/web 레포 정책: 네이티브 confirm/alert/prompt 금지 + 추가 export 허용.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'useConfirm()/ConfirmDialog를 사용하세요 (globalThis.confirm 금지).' },
        { name: 'alert', message: 'Toast/Dialog를 사용하세요 (globalThis.alert 금지).' },
        { name: 'prompt', message: 'usePrompt()/PromptDialog를 사용하세요 (globalThis.prompt 금지).' },
      ],
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: ['router'] },
      ],
      // 오버레이(Dialog 등)는 열릴 때 주 컨트롤로 포커스를 옮기는 것이 올바른
      // 모달 접근성 동작이라 autoFocus 를 의도적으로 사용한다.
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // components/ui — Radix 프리미티브를 얇게 재노출하는 디자인시스템 배럴
  // (`export const Dialog = DialogPrimitive.Root` 등). react-refresh 는 멤버
  // 표현식 재노출을 컴포넌트로 인식하지 못해 오탐한다. 이 파일들은 라우트/페이지가
  // 아니라 리프 프리미티브 모듈이라 fast-refresh 경계 제약이 적용되지 않으므로
  // 이 디렉터리에 한해서만 규칙을 끈다(레포 전역 비활성 아님).
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

  // packages/* — isomorphic 라이브러리(shared·sdk·widget). Node globals.
  {
    files: ['packages/**/*.{ts,tsx}'],
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
