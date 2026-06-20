import { NestFactory } from '@nestjs/core'

import { AppModule } from '../app.module'

import { DatabaseService } from './database.service'
import { runSeed } from './seed-data'

/** 명시적 시드 스크립트: `pnpm db:seed`. saas 모드에서도 데모 데이터를 채웁니다. */
async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const dbs = app.get(DatabaseService)
    const result = await runSeed(dbs, { demo: true })
    console.log(result.seeded ? '✅ 데모 시드 완료 (pk_demo / sk_demo)' : 'ℹ️  이미 데이터가 있어 시드를 건너뜀')
  } finally {
    await app.close()
  }
}

void main().catch((err) => {
  console.error(err)
  process.exit(1)
})
