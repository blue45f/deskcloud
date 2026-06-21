import { AdminTokenGuard } from '@desk/core/nest'
import {
  inquiryListQuerySchema,
  submitInquirySchema,
  updateInquiryStatusSchema,
  type InquiryAdminDto,
  type InquiryDto,
  type InquiryListDto,
  type InquiryListQuery,
  type SubmitInquiryInput,
  type UpdateInquiryStatusInput,
} from '@desk/shared'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { InquiriesService } from './inquiries.service'

import type { Response } from 'express'

/**
 * 문의 API — 형제 앱이 공개 REST 로 직접 호출하는 게시판(SDK 불필요).
 *
 * 공개(키 인증 없음, CORS 개방):
 *  - `POST /api/v1/apps/:appId/inquiries` — 제출(허니팟 드롭 시 202).
 *  - `GET  /api/v1/apps/:appId/inquiries` — 공개 게시판 목록(회신 이메일 redact).
 *
 * 어드민(X-Admin-Token):
 *  - `GET   /api/v1/apps/:appId/inquiries/admin` — 회신 이메일 포함 목록(status/originHost 필터).
 *  - `PATCH /api/v1/apps/:appId/inquiries/:id/status` — 상태 변경(트리아지).
 */
@ApiTags('inquiries')
@Controller('v1/apps/:appId/inquiries')
export class InquiriesController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post()
  // 공개 위젯 — 봇/스팸 폭주 방지를 위해 IP당 분당 10건으로 스로틀(tenants 가입과 동일 수위).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '문의 제출(공개) — 허니팟 website 가 채워지면 202(silently dropped)',
  })
  async submit(
    @Param('appId') appId: string,
    @Body(new ZodValidationPipe(submitInquirySchema)) body: SubmitInquiryInput,
    @Res({ passthrough: true }) res: Response
  ): Promise<InquiryDto | { accepted: true }> {
    const result = await this.inquiries.submit(appId, body)
    if (result.dropped || !result.inquiry) {
      // 봇에 단서를 주지 않도록 정상처럼 202 로 수락만 하고 본문은 최소화.
      res.status(202)
      return { accepted: true }
    }
    res.status(201)
    return result.inquiry
  }

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '공개 게시판 목록 — 앱별 최신순(회신 이메일·출처 URL 제외)' })
  listPublic(
    @Param('appId') appId: string,
    @Query(new ZodValidationPipe(inquiryListQuerySchema)) query: InquiryListQuery
  ): Promise<InquiryListDto> {
    return this.inquiries.listPublic(appId, query)
  }

  @Get('admin')
  @UseGuards(AdminTokenGuard)
  @ApiSecurity('adminToken')
  @ApiOperation({
    summary: '어드민 목록(X-Admin-Token) — 회신 이메일·출처 URL 포함, status/originHost 필터',
  })
  listAdmin(
    @Param('appId') appId: string,
    @Query(new ZodValidationPipe(inquiryListQuerySchema)) query: InquiryListQuery
  ): Promise<InquiryListDto<InquiryAdminDto>> {
    return this.inquiries.listAdmin(appId, query)
  }

  @Patch(':id/status')
  @HttpCode(200)
  @UseGuards(AdminTokenGuard)
  @ApiSecurity('adminToken')
  @ApiOperation({ summary: '문의 상태 변경(X-Admin-Token) — new/in_progress/resolved/closed' })
  async setStatus(
    @Param('appId') appId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInquiryStatusSchema)) body: UpdateInquiryStatusInput
  ): Promise<InquiryAdminDto> {
    const updated = await this.inquiries.setStatus(appId, id, body.status)
    if (!updated) throw new NotFoundException('해당 문의를 찾을 수 없습니다')
    return updated
  }
}
