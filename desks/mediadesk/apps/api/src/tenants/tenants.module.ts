import { Module } from '@nestjs/common'

import { SignupController } from './signup.controller'
import { TenantsService } from './tenants.service'

/** 테넌트 도메인 — 가입(공개) + 서비스(가드·어드민이 공유). */
@Module({
  controllers: [SignupController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
