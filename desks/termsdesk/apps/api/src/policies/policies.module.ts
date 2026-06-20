import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'

import { PoliciesController } from './policies.controller'
import { PoliciesService } from './policies.service'
import { VersionItemController, VersionsController } from './versions.controller'
import { VersionsService } from './versions.service'

@Module({
  imports: [AuthModule],
  controllers: [PoliciesController, VersionsController, VersionItemController],
  providers: [PoliciesService, VersionsService],
  exports: [PoliciesService, VersionsService],
})
export class PoliciesModule {}
