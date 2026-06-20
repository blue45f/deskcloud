import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'

import { APP_CONFIG, isSeedingEnabled, type AppConfig } from './config'
import { DatabaseService } from './db/database.service'
import { DEMO_PUBLISHABLE_KEY, DEMO_SECRET_KEY, runSeed } from './db/seed-data'
import { StorageService } from './storage/storage.service'

/** 앱 부트스트랩 시 (self-hosted/시드 활성) 데모 테넌트·샘플 자산 시드. 멱등. */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Bootstrap')

  constructor(
    private readonly dbs: DatabaseService,
    private readonly storage: StorageService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!isSeedingEnabled(this.cfg)) return
    const demo = process.env.MEDIADESK_SEED_DEMO !== 'false'
    try {
      const result = await runSeed(this.dbs, this.storage, this.cfg, { demo })
      if (result.seeded) {
        this.logger.log('데모 테넌트·샘플 자산 시드 완료')
        this.logger.log(`  데모 publishable: ${DEMO_PUBLISHABLE_KEY}`)
        this.logger.log(`  데모 secret(sk_) : ${DEMO_SECRET_KEY}`)
      }
    } catch (err) {
      this.logger.error('시드 중 오류', err as Error)
    }
  }
}
