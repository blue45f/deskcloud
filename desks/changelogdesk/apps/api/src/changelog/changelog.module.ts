import { Module } from '@nestjs/common'

import { AdminChangelogController } from '../admin/admin-changelog.controller'
import { TenantsModule } from '../tenants/tenants.module'

import { ChangelogPublicController } from './changelog.controller'
import { ChangelogService } from './changelog.service'

/** 체인지로그 도메인 — 공개(위젯) + 어드민 컨트롤러가 동일 서비스를 공유. */
@Module({
  imports: [TenantsModule],
  controllers: [ChangelogPublicController, AdminChangelogController],
  providers: [ChangelogService],
  exports: [ChangelogService],
})
export class ChangelogModule {}
