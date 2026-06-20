import { Module } from '@nestjs/common'

import { AdminController } from '../admin/admin.controller'
import { TenantsModule } from '../tenants/tenants.module'
import { VisitsModule } from '../visits/visits.module'

import { AssetsPublicController } from './assets.public.controller'
import { AssetsService } from './assets.service'
import { FileController } from './file.controller'

/**
 * 자산 도메인 — 공개(위젯) 업로드/목록 + 파일 서빙 + 어드민 관리가 동일 서비스를 공유한다.
 * 가드(PublishableAuthGuard·AdminAuthGuard)는 TenantsService 가 필요하므로 TenantsModule 임포트.
 * AdminController 의 overview 가 방문 합계를 읽으므로 VisitsModule(VisitsService export)도 임포트.
 */
@Module({
  imports: [TenantsModule, VisitsModule],
  controllers: [AssetsPublicController, FileController, AdminController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
