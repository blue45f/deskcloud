import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. 런타임 워크스페이스 의존이 0이라 external 지정이 필요 없다.
// watch(dev)에서는 clean 비활성 — 소비자(widget/api)의 콜드스타트 레이스 방지.
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
}))
