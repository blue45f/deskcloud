import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'

import { RealtimeAuthService } from './realtime-auth.service'
import { RealtimeController } from './realtime.controller'
import { RealtimeGateway } from './realtime.gateway'

@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
  providers: [RealtimeAuthService, RealtimeGateway],
  exports: [RealtimeGateway, RealtimeAuthService],
})
export class RealtimeModule {}
