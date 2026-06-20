import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  markReadSchema,
  recipientIdSchema,
  type InboxDto,
  type MarkReadInput,
  type MarkReadResultDto,
  type UnreadCountDto,
} from '@notifydesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { PublishableKeyGuard } from '../tenants/publishable-key.guard'
import { getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'

import { InboxService } from './inbox.service'

/** 공개(publishable 키 + Origin) — 사용자가 자기 인박스를 읽고 읽음 처리한다. */
@ApiTags('inbox (publishable)')
@ApiHeader({ name: 'Authorization', required: true, description: 'Bearer pk_… (publishable 키)' })
@Controller('inbox')
@UseGuards(PublishableKeyGuard)
export class InboxController {
  constructor(private readonly inbox: InboxService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiQuery({ name: 'recipientId', required: true })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: '인박스 목록(최신순) + 미읽음 카운트' })
  list(
    @Req() req: AuthedRequest,
    @Query('recipientId') recipientId: string,
    @Query('limit') limit?: string
  ): Promise<InboxDto> {
    const { tenant } = getTenantCtx(req)
    const rid = this.parseRecipientId(recipientId)
    return this.inbox.list(tenant.id, rid, limit)
  }

  @Get('unread-count')
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @ApiQuery({ name: 'recipientId', required: true })
  @ApiOperation({ summary: '미읽음 카운트' })
  unreadCount(
    @Req() req: AuthedRequest,
    @Query('recipientId') recipientId: string
  ): Promise<UnreadCountDto> {
    const { tenant } = getTenantCtx(req)
    const rid = this.parseRecipientId(recipientId)
    return this.inbox.unreadCount(tenant.id, rid)
  }

  @Post('read')
  @HttpCode(200)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: '읽음 처리 — ids 목록 또는 all=true' })
  markRead(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(markReadSchema)) body: MarkReadInput
  ): Promise<MarkReadResultDto> {
    const { tenant } = getTenantCtx(req)
    return this.inbox.markRead(tenant.id, body)
  }

  private parseRecipientId(value: string): string {
    const result = recipientIdSchema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException('recipientId 쿼리 파라미터가 유효하지 않습니다')
    }
    return result.data
  }
}
