import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. react 는 external(peer). @mediadesk/sdk 는 작은 런타임 값(클라이언트·
// buildUrl)을 import 하지만 워크스페이스 소비자가 해소하므로 external 로 둔다.
// IIFE(브라우저 <script>) 빌드는 vite.iife.config.ts 가 담당(react·sdk 인라인).
//
// watch(dev)에서는 clean 비활성 — 콜드스타트 레이스 방지.
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
  external: ['react', 'react-dom', 'react/jsx-runtime', '@mediadesk/sdk'],
}))
