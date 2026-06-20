import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. @searchdesk/shared 는 타입만 쓰므로 external 로 두고
// 소비자 측 워크스페이스/번들러가 해소하게 한다(런타임 의존 0, fetch 만 사용).
//
// watch(dev) 에서는 clean 비활성 — shared 콜드스타트 레이스 방지(shared tsup.config 참고).
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
  external: ['@searchdesk/shared'],
}))
