import { defineConfig } from 'drizzle-kit'

// 참고: 런타임 부팅 마이그레이터(src/db/migrate.ts)는 src/db/migrations/*.sql 을
// pg / PGlite 양쪽에 동일하게 적용합니다. 이 설정은 향후 `pnpm db:generate` 로
// 스키마 변경분 SQL을 생성할 때 사용합니다.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
})
