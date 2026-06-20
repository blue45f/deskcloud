import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ConsentsModule } from '../consents/consents.module'
import { PoliciesModule } from '../policies/policies.module'

import { ExportController } from './export.controller'

@Module({
  imports: [AuthModule, ConsentsModule, PoliciesModule],
  controllers: [ExportController],
})
export class ExportModule {}
