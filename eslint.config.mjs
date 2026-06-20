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
    // 단일파일 벤더드 위젯(공식 임베드 스니펫). react-compiler/jsx-a11y 를 의도적으로
    // 위반하는 자급자족 소스라 lint 대상에서 제외한다(위젯 소스는 수정하지 않는다).
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

  // apps/web 레포 정책.
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      // 라우트 테이블은 lazy 컴포넌트 + router export 혼재 → fast-refresh 제약 완화.
      'react-refresh/only-export-components': [
        'error',
        { allowConstantExport: true, allowExportNames: ['router'] },
      ],
      // 오버레이(Dialog)·인증 폼은 열릴 때 주 컨트롤로 포커스를 옮기는 것이 올바른 모달
      // 접근성 동작이라 autoFocus 를 의도적으로 사용한다.
      'jsx-a11y/no-autofocus': 'off',
    },
  },

  // components/ui — Radix 프리미티브 래퍼 배럴. `Dialog = DialogPrimitive.Root` 처럼
  // 프리미티브 재export 와 래퍼 컴포넌트를 한 파일에 묶는 것이 UI 킷의 관용 패턴이라
  // fast-refresh 의 컴포넌트-전용 export 제약을 이 디렉터리에 한해 완화한다.
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

  // packages/** — 라이브러리(shared·sdk·widget). isomorphic/서버 + 브라우저 위젯이라
  // Node + browser 글로벌을 모두 허용한다. React 위젯(badge/react.tsx)은 퍼블리시되는
  // 라이브러리 소스라 apps/web 전용 react() 게이트(fast-refresh·a11y)를 적용하지 않는다.
  {
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
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
