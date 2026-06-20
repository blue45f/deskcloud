import { Global, Module } from '@nestjs/common'

import { PublishableKeyGuard } from './publishable-key.guard'
import { SecretKeyGuard } from './secret-key.guard'
import { TenantsController } from './tenants.controller'
import { TenantsService } from './tenants.service'

/**
 * 테넌트 도메인 — 가입 컨트롤러 + 서비스 + 인증 가드.
 * 가드/서비스는 다른 모듈(search·documents·admin)이 쓰므로 @Global.
 */
@Global()
@Module({
  controllers: [TenantsController],
  providers: [TenantsService, PublishableKeyGuard, SecretKeyGuard],
  exports: [TenantsService, PublishableKeyGuard, SecretKeyGuard],
})
export class TenantsModule {}
