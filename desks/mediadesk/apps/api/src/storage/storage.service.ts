import { Inject, Injectable } from '@nestjs/common'

import { APP_CONFIG, type AppConfig } from '../config'

import { LocalStorageAdapter } from './local.adapter'
import { S3StorageAdapter } from './s3.adapter'

import type { StorageAdapter } from './storage.adapter'

/**
 * 활성 스토리지 어댑터를 결정·노출한다. STORAGE_DRIVER 로 local(기본)·s3(스텁) 선택.
 * 어댑터는 부팅 시 한 번 생성되어 싱글톤으로 공유된다(어댑터 교체 시 이 서비스만 수정).
 */
@Injectable()
export class StorageService {
  private readonly adapter: StorageAdapter

  constructor(@Inject(APP_CONFIG) cfg: AppConfig) {
    this.adapter =
      cfg.storageDriver === 's3'
        ? new S3StorageAdapter(cfg.s3)
        : new LocalStorageAdapter(cfg.storageLocalDir)
  }

  get(): StorageAdapter {
    return this.adapter
  }

  get driver(): string {
    return this.adapter.driver
  }

  describe(): string {
    return this.adapter.describe()
  }
}
