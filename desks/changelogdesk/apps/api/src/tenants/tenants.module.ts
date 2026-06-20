import { Module } from '@nestjs/common'

import { AdminTenantController } from '../admin/admin-tenant.controller'

import { TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'

/** 테넌트 도메인 — 공개 온보딩(signup) + 어드민 설정/키. TenantContextService 는 CoreModule(전역). */
@Module({
  controllers: [TenantsController, AdminTenantController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
