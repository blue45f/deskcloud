import { base, react, plugin, defineConfig } from '@heejun/eslint-config'
import { globalIgnores } from 'eslint/config'
import globals from 'globals'

// MediaDesk pnpm monorepo flat config. Adopts the shared @heejun/eslint-config
// (TS + import 위생 + React 19/RC + jsx-a11y + 커스텀 규칙 + prettier 충돌 비활성)
// as the single source of lint rules, then layers only the repo-specific
// overrides on top. Prettier owns formatting via the package.json `prettier`
// field + the `format:check` step; this config enforces correctness/quality only.
export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/build/**',
    '**/coverage/**',
    '**/node_modules/**',
    '**/*.d.ts',
    '**/*.config.{js,mjs,cjs,ts}',
    // 단일 파일 벤더 위젯: 형제 앱에 그대로 복붙하는 캐논 사본이라
    // react-compiler/jsx-a11y 등 일부 규칙을 의도적으로 어긴다. 소스는 건드리지 않고
    // 린트에서 제외한다(위젯 정본은 packages/widget).
    '**/apps-vendor/**',
  ]),

  // 공유 베이스(TS + import 위생 + 커스텀 규칙 + prettier 충돌 비활성).
  base({ files: ['**/*.{ts,tsx}'] }),

  // apps/web — React 19 + Vite + RC + jsx-a11y.
  react({ files: ['apps/web/**/*.{ts,tsx}'] }),

  // packages/widget — 임베드용 React 컴포넌트 라이브러리(브라우저 타깃, react peer).
  react({ files: ['packages/widget/**/*.{ts,tsx}'] }),

  // heejun 개인 테스트/목 컨벤션 규칙은 비활성 — 횡단 일관성 대상이 아니라
  // MediaDesk 자체 테스트 스타일과 충돌한다(shared base 의 일반 규칙만 채택).
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
      // 네이티브 confirm/alert/prompt 금지.
      'no-restricted-globals': [
        'error',
        { name: 'confirm', message: 'useConfirm()/ConfirmDialog를 사용하세요 (globalThis.confirm 금지).' },
        { name: 'alert', message: 'Toast/Dialog를 사용하세요 (globalThis.alert 금지).' },
        { name: 'prompt', message: 'usePrompt()/PromptDialog를 사용하세요 (globalThis.prompt 금지).' },
      ],
      // 로그인/가입 폼은 마운트 시 첫 입력에 포커스(autoFocus)를 두는 것이 의도된 UX다.
      // 단일 진입 폼에서 모달처럼 포커스를 옮기는 정당한 사용이라 규칙을 끈다(offhours 와 동일 판단).
      'jsx-a11y/no-autofocus': 'off',
      // React Compiler 의 실험적 진단. 여기 세 군데 useEffect 는 모두 정당한 외부 동기화다:
      // (1) getComputedStyle 로 라이브 DOM 토큰을 읽어 state 로 반영(DesignPage),
      // (2) 테마 변경 시 토큰 재해석용 nonce bump(DesignPage),
      // (3) 서버 쿼리(me) 도착 시 폼 필드 초기화(SettingsPage).
      // 외부 시스템→React 동기화라 이 규칙은 오탐이며, advisory 성격이라 apps/web 범위로만 끈다.
      'react-hooks/set-state-in-effect': 'off',
    },
  },

  // 라우트 테이블은 lazy 컴포넌트 + router export 혼재 가능성.
  {
    files: ['apps/web/src/router/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // UI 프리미티브 배럴(shadcn/Radix 스타일): 컴포넌트 export 와 함께 Radix 프리미티브
  // 참조를 그대로 재export(`export const Dialog = DialogPrimitive.Root` 등)한다. 이는
  // 상수 export 가 아니라 fast-refresh 가 컴포넌트 단위 export 만 허용하는 제약과 충돌하지만,
  // 위젯 라이브러리의 표준 합성 패턴이라 이 디렉토리에 한해 규칙을 끈다.
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

  // packages/** — isomorphic 라이브러리 (Node 기본). widget 은 위에서 react()로 덮음.
  {
    files: ['packages/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.node },
  },

  // packages/widget — 임베드 위젯의 정본 소스/데모. 소스는 의도적으로 손대지 않고,
  // 위젯 고유의 합당한 패턴과 충돌하는 규칙만 이 패키지 범위로 끈다:
  // - MediaGallery 의 클릭 가능한 그리드 셀은 <a role="listitem"> 로 리스트 시맨틱을 부여(의도).
  // - exhaustive-deps 를 의도적으로 끈 cleanup-only effect 때문에 RC 가 최적화를 건너뛴다고 보고.
  // - demo/ 는 빌드 산출물 없이 동작하는 부트스트랩 엔트리라 컴포넌트 export 가 없고,
  //   window 가드 플래그를 모듈 스코프에서 1회 세팅한다(데모 한정).
  {
    files: ['packages/widget/**/*.{ts,tsx}'],
    rules: {
      'jsx-a11y/no-interactive-element-to-noninteractive-role': 'off',
      'react-compiler/react-compiler': 'off',
      'react-hooks/immutability': 'off',
      'react-refresh/only-export-components': 'off',
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
