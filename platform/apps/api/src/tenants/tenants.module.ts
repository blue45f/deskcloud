import { Module } from '@nestjs/common'

import { TenantsController } from './tenants.controller'

/** 테넌트 도메인 — 컨트롤러는 CoreModule 이 제공하는 TenantService·UsageMeter 를 주입받는다. */
@Module({
  controllers: [TenantsController],
})
export class TenantsModule {}
