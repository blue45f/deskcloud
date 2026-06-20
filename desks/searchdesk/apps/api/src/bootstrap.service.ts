import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'

import { APP_CONFIG, isSeedingEnabled, type AppConfig } from './config'
import { DatabaseService } from './db/database.service'
import { runSeed } from './db/seed-data'

/** 앱 부트스트랩 시 (시드 활성) 데모 테넌트·샘플 문서 시드. 멱등. */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Bootstrap')

  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!isSeedingEnabled(this.cfg)) return
    // 데모 시드를 끄려면 SEARCHDESK_SEED_DEMO=false.
    const demo = process.env.SEARCHDESK_SEED_DEMO !== 'false'
    try {
      const result = await runSeed(this.dbs, { demo })
      if (result.seeded) {
        this.logger.log(`데모 테넌트·샘플 문서 시드 완료 (pk_demo / sk_demo, 문서 ${result.docCount}건)`)
      }
    } catch (err) {
      this.logger.error('시드 중 오류', err as Error)
    }
  }
}
