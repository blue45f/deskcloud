import { visitPingSchema, type VisitPingInput } from '@mediadesk/shared'
import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { VisitsService } from './visits.service'

/**
 * 공개 방문 핑 — 인증 없이 누구나 호출(브라우저가 하루 1회 발사).
 * 본문 { newToday } 는 클라이언트 localStorage 플래그에서 파생된 advisory 신호다.
 * 서버는 hits 를 항상 +1, visitors 는 newToday 일 때만 +1 한다(IP/쿠키 미저장).
 */
@ApiTags('visits (public)')
@Controller('visits')
export class VisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Post('ping')
  @HttpCode(204)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiOperation({ summary: '방문 1건 기록(fire-and-forget). newToday=고유 방문자 신호' })
  async ping(@Body(new ZodValidationPipe(visitPingSchema)) body: VisitPingInput): Promise<void> {
    await this.visits.recordVisit(body.newToday)
  }
}
