import {
  anonIdSchema,
  listEntriesQuerySchema,
  seenSchema,
  type OkDto,
  type PublicChangelogDto,
  type SeenInput,
  type UnreadCountDto,
} from '@changelogdesk/shared'
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'
import { PublishableKeyGuard, tenantOf } from '../tenants/publishable-key.guard'
import { type AuthedRequest } from '../tenants/request-context'
import { TenantsService } from '../tenants/tenants.service'

import { ChangelogService } from './changelog.service'

/**
 * 공개(위젯) — 퍼블리시 키(x-pk / ?pk=) + Origin 검사. 게시된 항목만 노출.
 * 목록 호출 시 테넌트 사용량을 +1 한다.
 */
@ApiTags('changelog (public · widget)')
@ApiHeader({ name: 'x-pk', required: false, description: '퍼블리시 키(pk_…). ?pk= 로도 가능' })
@Controller('changelog')
@UseGuards(PublishableKeyGuard)
export class ChangelogPublicController {
  constructor(
    private readonly changelog: ChangelogService,
    private readonly tenants: TenantsService
  ) {}

  @Get()
  @ApiQuery({ name: 'since', required: false, description: 'ISO 시각 — 이후 게시분만(증분)' })
  @ApiQuery({ name: 'limit', required: false, description: `최대 항목 수(기본 20, 최대 100)` })
  @ApiOperation({ summary: '위젯용 게시 체인지로그 목록(최신순). 사용량 +1' })
  async list(
    @Req() req: AuthedRequest,
    @Query(new ZodValidationPipe(listEntriesQuerySchema))
    query: ReturnType<typeof listEntriesQuerySchema.parse>
  ): Promise<PublicChangelogDto> {
    const tenant = tenantOf(req)
    const result = await this.changelog.listPublic(tenant, query)
    await this.tenants.incrementUsage(tenant.id)
    return result
  }

  @Post('seen')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '마지막 본 항목 기록(미읽음 배지용)' })
  async seen(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(seenSchema)) body: SeenInput
  ): Promise<OkDto> {
    await this.changelog.recordSeen(tenantOf(req), body)
    return { ok: true }
  }

  @Get('unread-count')
  @ApiQuery({ name: 'anonId', required: true, description: '위젯 디바이스 익명 식별자' })
  @ApiOperation({ summary: 'anonId 의 미읽음 개수' })
  unreadCount(
    @Req() req: AuthedRequest,
    @Query('anonId') anonId?: string
  ): Promise<UnreadCountDto> {
    const parsed = anonIdSchema.safeParse(anonId)
    if (!parsed.success) throw new BadRequestException('anonId 쿼리가 필요합니다')
    return this.changelog.unreadCount(tenantOf(req), parsed.data)
  }
}
