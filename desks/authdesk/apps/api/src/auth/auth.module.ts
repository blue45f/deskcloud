import { Module } from '@nestjs/common'

import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { EndUserGuard } from './end-user.guard'
import { TokenService } from './token.service'

/**
 * end-user 인증 모듈. TenantsModule(전역)이 노출한 TenantsService·PublishableKeyGuard·
 * SecretKeyGuard 와 CoreModule(전역)의 DatabaseService·APP_CONFIG 를 주입받는다.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, TokenService, EndUserGuard],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
