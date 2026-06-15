import { defineConfig } from 'vitest/config'

// NestJS 어댑터 가드는 데코레이터를 쓴다. vitest(esbuild)에서 legacy decorator 를
// 처리하도록 esbuild 옵션을 켜고, reflect-metadata 를 셋업에서 로드한다.
export default defineConfig({
  esbuild: {
    target: 'es2022',
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
        useDefineForClassFields: false,
      },
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
})
