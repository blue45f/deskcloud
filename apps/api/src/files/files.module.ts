import { Module } from '@nestjs/common'

import { FilesController } from './files.controller'
import { FilesService } from './files.service'
import { storageProvider } from './storage/storage.provider'

/**
 * 파일 도메인 — 공개 업로드/서빙 + 어드민 목록/통계/삭제/서명.
 * 스토리지 어댑터는 설정(DESK_STORAGE_DRIVER)에 따라 팩토리가 주입(postgres|s3).
 * 가드·TenantsService 는 @Global TenantsModule 이 제공한다.
 */
@Module({
  controllers: [FilesController],
  providers: [FilesService, storageProvider],
  exports: [FilesService],
})
export class FilesModule {}
