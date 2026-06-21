import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'

import { RealtimeAuthService } from './realtime-auth.service'
import { REALTIME_SOCKET_PATH } from './realtime.gateway'

import type { AuthUser } from '../common/request-context'
import type { RealtimeTokenDto } from '@termsdesk/shared'
import type { Request } from 'express'

@ApiTags('realtime')
@ApiBearerAuth('session')
@Controller('realtime')
@UseGuards(SessionGuard)
export class RealtimeController {
  constructor(private readonly auth: RealtimeAuthService) {}

  @Get('token')
  @ApiOperation({ summary: 'Socket.IO 접속용 단기 토큰 발급' })
  async token(@CurrentUser() user: AuthUser, @Req() req: Request): Promise<RealtimeTokenDto> {
    const issued = await this.auth.issueToken(user)
    return {
      token: issued.token,
      origin: this.auth.realtimeOrigin(req),
      path: REALTIME_SOCKET_PATH,
      expiresAt: issued.expiresAt.toISOString(),
    }
  }
}
