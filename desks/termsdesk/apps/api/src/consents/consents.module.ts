import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { PoliciesModule } from '../policies/policies.module'

import { ConsentsController, PublicConsentController } from './consents.controller'
import { ConsentsService } from './consents.service'

@Module({
  imports: [AuthModule, PoliciesModule],
  controllers: [PublicConsentController, ConsentsController],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}
