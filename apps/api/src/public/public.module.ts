import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'
import { ConsentsModule } from '../consents/consents.module'
import { OrgsModule } from '../orgs/orgs.module'
import { PoliciesModule } from '../policies/policies.module'

import { PublicProvidersController } from './public-providers.controller'
import { PublicProvidersService } from './public-providers.service'
import { PublicRenderController } from './public-render.controller'
import { PublicRenderService } from './public-render.service'
import { PublicController } from './public.controller'

@Module({
  imports: [AuthModule, PoliciesModule, ConsentsModule, OrgsModule],
  controllers: [PublicController, PublicProvidersController, PublicRenderController],
  providers: [PublicProvidersService, PublicRenderService],
})
export class PublicModule {}
