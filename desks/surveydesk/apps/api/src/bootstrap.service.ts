import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'

import { APP_CONFIG, isSeedingEnabled, type AppConfig } from './config'
import { DatabaseService } from './db/database.service'
import { runSeed } from './db/seed-data'

/** 앱 부트스트랩 시 (self-hosted/시드 활성) 데모 설문·샘플 응답 시드. 멱등. */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Bootstrap')

  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!isSeedingEnabled(this.cfg)) return
    // 운영 self-hosted 에서 데모 설문 시드를 끄려면 SURVEYDESK_SEED_DEMO=false.
    const demo = process.env.SURVEYDESK_SEED_DEMO !== 'false'
    try {
      const result = await runSeed(this.dbs, { demo })
      if (result.seeded) this.logger.log('데모 설문·샘플 응답 시드 완료 (demo, offhours)')
    } catch (err) {
      this.logger.error('시드 중 오류', err as Error)
    }
  }
}
