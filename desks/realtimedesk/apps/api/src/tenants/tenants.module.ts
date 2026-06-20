import { Module } from "@nestjs/common";

import { AdminTenantController } from "../admin/admin-tenant.controller";

import { TenantsController } from "./tenants.controller";
import { TenantsService } from "./tenants.service";

/** 테넌트 도메인 — 공개 가입 + 어드민(self-service) 컨트롤러가 동일 서비스를 공유. */
@Module({
  controllers: [TenantsController, AdminTenantController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
