import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  createInquirySchema,
  updateInquirySchema,
  type CreateInquiryInput,
  type InquiryDto,
  type InquiryListDto,
  type InquiryReceiptDto,
  type UpdateInquiryInput,
} from '@termsdesk/shared'

import { ClientIp, CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ZodValidationPipe } from '../common/zod.pipe'

import { InquiriesService } from './inquiries.service'

import type { AuthUser } from '../common/request-context'
import type { Response } from 'express'

/** 공개(무인증) — 형제 사이트의 문의 폼이 비공개 접수함으로 제출. 영수증(id)만 돌려준다. */
@ApiTags('public-inquiries')
@Controller('public/:siteSlug/inquiries')
export class InquiriesPublicController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: '문의 접수(비공개) — 본문·연락처는 응답에 포함하지 않음' })
  submit(
    @Param('siteSlug') siteSlug: string,
    @ClientIp() ip: string,
    @Headers('user-agent') userAgent: string | undefined,
    @Headers('origin') origin: string | undefined,
    @Body(new ZodValidationPipe(createInquirySchema)) body: CreateInquiryInput
  ): Promise<InquiryReceiptDto> {
    return this.inquiries.submit(siteSlug, body, { ip, userAgent, origin })
  }
}

/** 대시보드(세션) — 중앙 문의 보드. 가시성 스코프는 서비스가 강제한다. */
@ApiTags('inquiries')
@ApiBearerAuth('session')
@Controller('inquiries')
@UseGuards(SessionGuard)
export class InquiriesAdminController {
  constructor(private readonly inquiries: InquiriesService) {}

  @Get()
  @RequirePermission('inquiry.read')
  @ApiOperation({ summary: '문의 목록(필터: status·category·site, offset/limit)' })
  async list(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('category') category?: string,
    @Query('site') site?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ): Promise<InquiryListDto> {
    const result = await this.inquiries.list(user, { status, category, site, offset, limit })
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }

  @Get(':id')
  @RequirePermission('inquiry.read')
  @ApiOperation({ summary: '문의 단건' })
  getOne(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<InquiryDto> {
    return this.inquiries.getOne(user, id)
  }

  @Patch(':id')
  @RequirePermission('inquiry.manage')
  @ApiOperation({ summary: '문의 처리(상태·운영 메모) — 감사 로그 기록' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateInquirySchema)) body: UpdateInquiryInput
  ): Promise<InquiryDto> {
    return this.inquiries.update(user, id, body)
  }
}
