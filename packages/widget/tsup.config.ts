import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. react 는 external(peer). @searchdesk/sdk·@searchdesk/shared 는
// 소비자 측 워크스페이스에서 해소하도록 external 로 둔다.
// IIFE(브라우저 <script>) 빌드는 별도 vite.iife.config.ts 가 담당(react·sdk 인라인).
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지(shared/sdk tsup.config 참고).
export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.tsx',
    vanilla: 'src/vanilla.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@searchdesk/sdk',
    '@searchdesk/shared',
  ],
}))
