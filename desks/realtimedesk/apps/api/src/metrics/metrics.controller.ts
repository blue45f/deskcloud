import { Body, Controller, HttpCode, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { visitPingSchema, type VisitPingInput } from '@realtimedesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'

import { MetricsService } from './metrics.service'

/**
 * 공개 방문 추적 — 브라우저가 앱 부팅 시 1회 ping 한다(인증 없음).
 * `firstToday` 면 고유 방문자(+1), 모든 ping 은 조회(hit, +1). 개인정보는 저장하지 않는다.
 * rate-limit 으로 남용을 막는다(IP 당 분당 한도).
 */
@ApiTags('metrics (public)')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Post('ping')
  @HttpCode(204)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({
    summary: '방문 1건 기록 — hit(+1), firstToday 면 visitor(+1). 응답 본문 없음',
  })
  async ping(@Body(new ZodValidationPipe(visitPingSchema)) body: VisitPingInput): Promise<void> {
    await this.metrics.recordVisit(body)
  }
}
