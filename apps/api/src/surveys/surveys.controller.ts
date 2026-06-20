import { Body, Controller, Get, Headers, HttpCode, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  submitResponseSchema,
  type ResponseReceiptDto,
  type SubmitResponseInput,
  type SurveyDto,
} from '@surveydesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'

import { SurveysService } from './surveys.service'

/** 공개(무인증) — 형제 앱의 임베드 위젯이 활성 설문을 받고 응답을 제출한다. CORS 개방. */
@ApiTags('surveys (public)')
@Controller('surveys/:appId')
export class SurveysPublicController {
  constructor(private readonly surveys: SurveysService) {}

  @Get('active')
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiOperation({ summary: '위젯용 활성 설문 스키마 (활성본 없으면 404)' })
  getActive(@Param('appId') appId: string): Promise<SurveyDto> {
    return this.surveys.getActive(appId)
  }

  @Post('responses')
  @HttpCode(201)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiParam({ name: 'appId', example: 'demo' })
  @ApiOperation({ summary: '응답 제출 — 활성 설문 기준 검증, throttled. 영수증(id)만 반환' })
  submit(
    @Param('appId') appId: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('referer') referrer: string | undefined,
    @Body(new ZodValidationPipe(submitResponseSchema)) body: SubmitResponseInput
  ): Promise<ResponseReceiptDto> {
    return this.surveys.submitResponse(appId, body, { userAgent, referrer })
  }
}
