import { defineConfig } from 'vitest/config'

// pglite 테스트는 beforeEach 마다 새 DB 생성 + 마이그레이션 적용이라
// 워크스페이스 병렬 실행(pnpm -r test) 부하에서 기본 10s 훅 타임아웃을 넘을 수 있다.
export default defineConfig({
  test: {
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
})
