import { defineConfig } from 'tsup'

// watch(dev) 에서는 clean 비활성 — 빌드 시작 시 dist 를 지우면 api(nest --watch)가
// 컴파일 도중 @addesk/shared 타입을 못 찾는 콜드스타트 레이스가 발생함.
export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  target: 'es2023',
}))
