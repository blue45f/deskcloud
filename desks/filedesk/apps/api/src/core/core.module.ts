import { Global, Module } from '@nestjs/common'

import { APP_CONFIG, loadConfig } from '../config'
import { DatabaseService } from '../db/database.service'

/** 전역 코어 — 설정·DB 서비스를 모든 모듈에 노출. */
@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: loadConfig }, DatabaseService],
  exports: [APP_CONFIG, DatabaseService],
})
export class CoreModule {}
