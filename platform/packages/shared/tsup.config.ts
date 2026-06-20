import { defineConfig } from 'tsup'

// watch(dev) 에서는 clean 비활성 — 빌드 시작 시 dist 를 지우면 의존 패키지(core/api 의 watch)가
// 컴파일 도중 @desk/shared 타입을 못 찾는 콜드스타트 레이스가 발생함.
export default defineConfig((options) => ({
  entry: ['src/index.ts', 'src/browser.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  target: 'es2023',
}))
