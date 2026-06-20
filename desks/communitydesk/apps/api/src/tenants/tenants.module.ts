import { Global, Module } from '@nestjs/common'

import { PublishableKeyGuard } from '../common/publishable-key.guard'
import { SecretKeyGuard } from '../common/secret-key.guard'

import { AdminTenantController, TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'

/**
 * 테넌트 도메인 — 가입 컨트롤러 + 서비스 + 인증 가드.
 * 가드는 boards/posts/reactions 등 다른 모듈에서도 @UseGuards 로 쓰므로 전역으로 노출한다.
 */
@Global()
@Module({
  controllers: [TenantsController, AdminTenantController],
  providers: [TenantsService, PublishableKeyGuard, SecretKeyGuard],
  exports: [TenantsService, PublishableKeyGuard, SecretKeyGuard],
})
export class TenantsModule {}
