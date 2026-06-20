import { Module } from '@nestjs/common'

import { AuthModule } from '../auth/auth.module'

import { ApiKeysController } from './apikeys.controller'
import { ApiKeysService } from './apikeys.service'

@Module({
  imports: [AuthModule],
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
})
export class ApiKeysModule {}
