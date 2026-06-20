import { Module } from '@nestjs/common'

import { AdminTenantController } from '../admin/admin-tenant.controller'

import { AnyKeyGuard } from './any-key.guard'
import { PublishableKeyGuard } from './publishable-key.guard'
import { SecretKeyGuard } from './secret-key.guard'
import { MembersController, TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'

/**
 * 테넌트 도메인 — 공개 가입 + 멤버 토큰 발급(sk) + 어드민(self-service).
 * pk/sk/any 키 게이트를 제공해 대화·채팅 모듈이 재사용한다.
 */
@Module({
  controllers: [TenantsController, MembersController, AdminTenantController],
  providers: [TenantsService, PublishableKeyGuard, SecretKeyGuard, AnyKeyGuard],
  exports: [TenantsService, PublishableKeyGuard, SecretKeyGuard, AnyKeyGuard],
})
export class TenantsModule {}
