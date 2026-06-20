/**
 * 독립 시드 스크립트 — `pnpm --filter @mediadesk/api db:seed`.
 * Nest 컨텍스트 없이 DB·스토리지를 직접 초기화하고 데모 테넌트/자산을 멱등 시드한다.
 * (보통은 부팅 시 BootstrapService 가 자동 시드하므로 이 스크립트는 수동 보정용.)
 */
import { loadConfig } from '../config'
import { StorageService } from '../storage/storage.service'

import { DatabaseService } from './database.service'
import { runSeed } from './seed-data'

async function main(): Promise<void> {
  const cfg = loadConfig()
  const dbs = new DatabaseService(cfg)
  await dbs.onModuleInit()
  const storage = new StorageService(cfg)
  const result = await runSeed(dbs, storage, cfg, { demo: true })

  console.log(result.seeded ? '시드 완료(데모 테넌트·자산)' : '이미 데이터가 있어 시드 건너뜀')
  await dbs.onModuleDestroy()
}

void main().catch((err) => {
  console.error('시드 실패:', err)
  process.exit(1)
})
