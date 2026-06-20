import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. @moderationdesk/shared 는 타입만 쓰므로 external 로 둔다
// (소비자 측 워크스페이스/노드 모듈에서 해소). 런타임 의존성 0.
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지(shared tsup.config 참고).
export default defineConfig((options) => ({
  entry: { index: 'src/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2022',
  external: ['@moderationdesk/shared'],
}))
