import { defineConfig } from 'tsup'

// watch(dev) 에서는 clean 비활성 (콜드스타트 레이스 방지 — shared tsup.config 참고).
export default defineConfig((options) => ({
  entry: { index: 'src/index.ts', react: 'src/react.tsx' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
  external: ['react'],
}))
