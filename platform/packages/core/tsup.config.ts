import { defineConfig } from 'tsup'

// 두 엔트리: '.' = 프레임워크 무관 코어, './nest' = NestJS 어댑터(가드/프로바이더).
// Nest 어댑터는 데코레이터를 쓰므로 esbuild 의 legacy decorator 변환이 필요.
export default defineConfig((options) => ({
  entry: { index: 'src/index.ts', nest: 'src/nest.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  target: 'es2023',
  // NestJS peer 는 소비자가 제공 — 번들에 포함하지 않음.
  external: ['@nestjs/common', 'reflect-metadata'],
}))
