import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common'

import { APP_CONFIG, isSeedingEnabled, type AppConfig } from './config'
import { DatabaseService } from './db/database.service'
import { runSeed } from './db/seed-data'

/** 앱 부트스트랩 시 조직/관리자 보장 + (self-hosted) 데모 시드. */
@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Bootstrap')

  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!isSeedingEnabled(this.cfg)) return
    // 운영 self-hosted 에서는 TERMSDESK_SEED_DEMO=false 로 데모 정책 시드를 끄고
    // 관리자 계정만 보장할 수 있습니다(조직/관리자는 항상 보장).
    const demo = this.cfg.mode === 'self-hosted' && process.env.TERMSDESK_SEED_DEMO !== 'false'
    try {
      const result = await runSeed(this.dbs, this.cfg, { demo })
      if (result.seeded) {
        this.logger.log(
          `데모 데이터 시드 완료 — 로그인: ${this.cfg.seedAdminEmail} / ${this.cfg.seedAdminPassword}`
        )
      }
    } catch (err) {
      this.logger.error('시드 중 오류', err as Error)
    }
  }
}
