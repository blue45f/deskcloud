import { Global, Module } from '@nestjs/common'

import { APP_CONFIG, loadConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { StorageService } from '../storage/storage.service'
import { TransformService } from '../transform/transform.service'

/** 전역 코어 — 설정·DB·스토리지·변환 서비스를 모든 모듈에 노출. */
@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: loadConfig },
    DatabaseService,
    StorageService,
    TransformService,
  ],
  exports: [APP_CONFIG, DatabaseService, StorageService, TransformService],
})
export class CoreModule {}
