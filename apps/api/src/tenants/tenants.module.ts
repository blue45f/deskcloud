import { Global, Module } from '@nestjs/common'

import { AdminTokenGuard } from './admin-token.guard'
import { PublishableKeyGuard } from './publishable-key.guard'
import { SecretKeyGuard } from './secret-key.guard'
import { TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'

/**
 * 테넌트 모듈 — 멀티테넌트 코어(서비스 + 가드). 전역으로 노출해 auth 모듈이
 * PublishableKeyGuard·SecretKeyGuard·TenantsService 를 그대로 주입받게 한다.
 */
@Global()
@Module({
  controllers: [TenantsController],
  providers: [TenantsService, PublishableKeyGuard, SecretKeyGuard, AdminTokenGuard],
  exports: [TenantsService, PublishableKeyGuard, SecretKeyGuard, AdminTokenGuard],
})
export class TenantsModule {}
