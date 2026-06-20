import { type FactoryProvider } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../../config'
import { DatabaseService } from '../../db/database.service'

import { PostgresStorageAdapter } from './postgres-storage.adapter'
import { S3StorageAdapter } from './s3-storage.adapter'

import type { StorageAdapter } from './storage.adapter'

/** 스토리지 어댑터 주입 토큰. */
export const STORAGE_ADAPTER = Symbol('STORAGE_ADAPTER')

/**
 * 설정(DESK_STORAGE_DRIVER)에 따라 스토리지 어댑터를 고르는 Nest 팩토리 프로바이더.
 * postgres(기본): bytea 인라인. s3: S3/R2 스텁(자격증명 필요).
 */
export const storageProvider: FactoryProvider<StorageAdapter> = {
  provide: STORAGE_ADAPTER,
  inject: [APP_CONFIG, DatabaseService],
  useFactory: (cfg: AppConfig, dbs: DatabaseService): StorageAdapter => {
    if (cfg.storageDriver === 's3') return new S3StorageAdapter(cfg.s3)
    return new PostgresStorageAdapter(dbs)
  },
}
