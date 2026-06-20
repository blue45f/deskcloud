import { defineConfig } from 'tsup'

// ESM/CJS + d.ts 번들. 브라우저 진입(index)은 socket.io-client 를 external 로 두고
// (소비자 번들러가 해소), 서버 admin 진입(admin)은 node 의 fetch 만 쓰므로 의존성 0.
// @chatdesk/shared 는 런타임 값(상수)도 쓰므로 external(워크스페이스에서 해소).
//
// watch(dev) 에서는 clean 비활성 — 콜드스타트 레이스 방지.
export default defineConfig((options) => ({
  entry: {
    index: 'src/index.ts',
    admin: 'src/admin.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  treeshake: true,
  target: 'es2020',
  external: ['socket.io-client', '@chatdesk/shared'],
}))
