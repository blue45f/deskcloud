import {
  adminReportQuerySchema,
  submitReportSchema,
  updateReportSchema,
  type AdminReportQuery,
  type ReportDto,
  type ReportListDto,
  type ReportReceiptDto,
  type SubmitReportInput,
  type UpdateReportInput,
} from '@moderationdesk/shared'
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { PublishableKeyGuard } from '../common/publishable-key.guard'
import { SecretKeyGuard } from '../common/secret-key.guard'
import { tenantOf, type TenantRequest } from '../common/tenant-context'
import { ZodValidationPipe } from '../common/zod.pipe'

import { ReportsService } from './reports.service'

import type { Response } from 'express'

/** 공개(publishable) — 위젯/클라이언트가 콘텐츠를 신고한다. 인증: x-pk + Origin. */
@ApiTags('reports (public)')
@ApiHeader({ name: 'X-Pk', required: true, description: 'publishable 키(pk_...)' })
@Controller('reports')
@UseGuards(PublishableKeyGuard)
export class ReportsPublicController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: '신고 접수 — 영수증(id·status) 반환. 상태는 open 으로 시작' })
  submit(
    @Req() req: TenantRequest,
    @Body(new ZodValidationPipe(submitReportSchema)) body: SubmitReportInput
  ): Promise<ReportReceiptDto> {
    return this.reports.submitReport(tenantOf(req), body)
  }
}

/**
 * 어드민 — 신고 조회·전이. 인증: x-sk(테넌트 secret) 또는 글로벌 X-Admin-Token.
 * 글로벌 토큰 사용 시 대상 테넌트를 x-tenant-id / ?tenantId= / x-pk 로 지정(SecretKeyGuard).
 */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_...)' })
@ApiHeader({
  name: 'X-Admin-Token',
  required: false,
  description: '글로벌 ADMIN_TOKEN(셀프호스트)',
})
@Controller('admin/reports')
@UseGuards(SecretKeyGuard)
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  @ApiOperation({ summary: '신고 목록 — status/subjectType 필터, 페이지네이션(offset/limit)' })
  async list(
    @Req() req: TenantRequest,
    @Res({ passthrough: true }) res: Response,
    @Query(new ZodValidationPipe(adminReportQuerySchema)) query: AdminReportQuery
  ): Promise<ReportListDto> {
    const result = await this.reports.listReports(tenantOf(req), query)
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }

  @Patch(':id')
  @ApiParam({ name: 'id', description: '신고 id(uuid)' })
  @ApiOperation({
    summary: '신고 갱신 — status(open|reviewing|resolved|dismissed) 그리고/또는 notes',
  })
  update(
    @Req() req: TenantRequest,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateReportSchema)) body: UpdateReportInput
  ): Promise<ReportDto> {
    return this.reports.updateReport(tenantOf(req), id, body)
  }
}
