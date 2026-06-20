import {
  toggleReactionSchema,
  type ReactionToggleDto,
  type ToggleReactionInput,
} from '@communitydesk/shared'
import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { PublishableKeyGuard } from '../common/publishable-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { ReactionsService } from './reactions.service'

/**
 * 공개(publishable) — 멤버가 글/댓글에 반응을 토글한다.
 * 인증: x-pk(또는 ?pk=) + Origin 허용목록.
 */
@ApiTags('reactions (public)')
@ApiHeader({ name: 'X-Pk', required: true, description: 'publishable 키(pk_...)' })
@Controller('reactions')
@UseGuards(PublishableKeyGuard)
export class ReactionsPublicController {
  constructor(private readonly reactions: ReactionsService) {}

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: '반응 토글(post|comment) — 갱신된 집계 반환' })
  toggle(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(toggleReactionSchema)) body: ToggleReactionInput
  ): Promise<ReactionToggleDto> {
    return this.reactions.toggle(tenantOf(req), body)
  }
}
