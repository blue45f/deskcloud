import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. 런타임 의존성 0(타입만 @communitydesk/shared 에서 끌어옴)이므로
// shared 는 external 로 두고 소비자 측 워크스페이스에서 해소한다.
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지(shared tsup.config 참고).
export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    browser: 'src/browser.ts',
    admin: 'src/admin.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
  external: ['@communitydesk/shared'],
}))
