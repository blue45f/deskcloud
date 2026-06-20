import { defineConfig } from 'tsup'

// 두 엔트리: '.' = 프레임워크 무관 빌링(플랜·어댑터·집행·구독), './nest' = NestJS 어댑터(가드).
export default defineConfig((options) => ({
  entry: { index: 'src/index.ts', nest: 'src/nest.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: !options.watch,
  sourcemap: true,
  target: 'es2023',
  // NestJS peer 는 소비자가 제공 — 번들에 포함하지 않음.
  external: ['@nestjs/common', '@nestjs/core', 'reflect-metadata'],
}))
