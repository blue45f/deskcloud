import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ConsentsService } from '../consents/consents.service'
import { VersionsService } from '../policies/versions.service'

import type { AuthUser } from '../common/request-context'
import type { Response } from 'express'

function csvField(value: unknown): string {
  const s = value == null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.join(','), ...rows.map((r) => r.map(csvField).join(','))]
  // BOM 추가 → Excel 한글 깨짐 방지
  return '﻿' + lines.join('\r\n') + '\r\n'
}

@ApiTags('export')
@ApiBearerAuth('session')
@Controller('export')
@UseGuards(SessionGuard)
export class ExportController {
  constructor(
    private readonly consents: ConsentsService,
    private readonly versions: VersionsService
  ) {}

  @Get('consents.csv')
  @RequirePermission('consent.read')
  @ApiOperation({ summary: '동의 영수증 CSV 내보내기(규제 대응 증거)' })
  async exportConsents(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
    @Query('policySlug') policySlug?: string,
    @Query('subjectRef') subjectRef?: string
  ): Promise<string> {
    const rows = await this.consents.list(user.orgId, { policySlug, subjectRef, limit: 500 })
    const csv = toCsv(
      [
        'receiptId',
        'subjectRef',
        'policySlug',
        'versionLabel',
        'decision',
        'method',
        'contentHash',
        'createdAt',
      ],
      rows.map((r) => [
        r.id,
        r.subjectRef,
        r.policySlug,
        r.versionLabel,
        r.decision,
        r.method,
        r.contentHash,
        r.createdAt,
      ])
    )
    res.header('Content-Type', 'text/csv; charset=utf-8')
    res.header('Content-Disposition', 'attachment; filename="consent-receipts.csv"')
    return csv
  }

  @Get('policies/:policyId/versions.csv')
  @RequirePermission('policy.read')
  @ApiOperation({ summary: '정책 버전 이력 CSV 내보내기' })
  async exportVersions(
    @CurrentUser() user: AuthUser,
    @Param('policyId') policyId: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<string> {
    const rows = await this.versions.listForPolicy(user.orgId, policyId)
    const csv = toCsv(
      [
        'versionLabel',
        'title',
        'status',
        'locale',
        'contentHash',
        'requiresReconsent',
        'effectiveAt',
        'publishedAt',
        'publishedBy',
      ],
      rows.map((v) => [
        v.versionLabel,
        v.title,
        v.status,
        v.locale,
        v.contentHash ?? '',
        v.requiresReconsent,
        v.effectiveAt ?? '',
        v.publishedAt ?? '',
        v.publishedByName ?? '',
      ])
    )
    res.header('Content-Type', 'text/csv; charset=utf-8')
    res.header('Content-Disposition', `attachment; filename="versions-${policyId}.csv"`)
    return csv
  }
}
