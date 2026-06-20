import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. @notifydesk/shared 는 타입만 쓰므로 external(소비자 워크스페이스에서 해소).
// 런타임 의존성 0 — 전역 fetch 만 사용한다(Node 18+·엣지·Deno·브라우저).
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지(shared/widget tsup.config 참고).
export default defineConfig((options) => ({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2022',
  external: ['@notifydesk/shared'],
}))
