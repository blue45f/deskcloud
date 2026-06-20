import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. react 는 external(peer). @reviewdesk/shared 도 external —
// 워크스페이스/npm 소비자가 직접 해소하므로 zod 를 위젯 번들에 끌고 오지 않아 산출물이 가볍다.
// IIFE(브라우저 <script>) 빌드는 별도 vite.iife.config.ts 가 shared(+react)를 인라인한다.
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지(shared tsup.config 참고).
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
  external: ['react', 'react-dom', 'react/jsx-runtime', '@reviewdesk/shared'],
}))
