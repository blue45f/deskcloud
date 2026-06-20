import {
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ApiKeyGuard } from '../auth/api-key.guard'
import { CurrentApiKey, RequireScope } from '../auth/decorators'
import { APP_CONFIG, type AppConfig } from '../config'
import { ConsentsService } from '../consents/consents.service'
import { OrgsService } from '../orgs/orgs.service'
import { PoliciesService } from '../policies/policies.service'
import { VersionsService } from '../policies/versions.service'

import type { ApiKeyContext } from '../common/request-context'
import type { PolicyType, PublicPolicyDto } from '@termsdesk/shared'
import type { Response } from 'express'

/** 공개 게시(서빙) — API 키로 현재 게시된 약관 버전을 가져갑니다. SDK 의 read 경로. */
@ApiTags('public')
@ApiBearerAuth('apiKey')
@Controller('v1/policies')
@UseGuards(ApiKeyGuard)
export class PublicController {
  constructor(
    private readonly policies: PoliciesService,
    private readonly versions: VersionsService,
    private readonly consents: ConsentsService,
    private readonly orgs: OrgsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  @Get(':slug/current')
  @RequireScope('read:current')
  @ApiOperation({ summary: '현재 게시된 버전 + content_hash (+ subjectRef 시 재동의 여부)' })
  async current(
    @CurrentApiKey() key: ApiKeyContext,
    @Param('slug') slug: string,
    @Res({ passthrough: true }) res: Response,
    @Query('locale') _locale?: string,
    @Query('subjectRef') subjectRef?: string
  ): Promise<PublicPolicyDto> {
    const policy = await this.policies.getRow(key.orgId, slug)
    if (!policy.currentVersionId) {
      throw new NotFoundException('이 정책에는 아직 게시된 버전이 없습니다')
    }
    const v = await this.versions.getVersionRow(key.orgId, policy.currentVersionId)
    const org = await this.orgs.getRow(key.orgId)
    res.setHeader('Cache-Control', `public, max-age=${this.cfg.publicCacheTtl}`)

    const dto: PublicPolicyDto = {
      policySlug: policy.slug,
      name: policy.name,
      type: policy.type as PolicyType,
      locale: v.locale,
      versionId: v.id,
      versionLabel: v.versionLabel,
      contentHash: v.contentHash ?? '',
      body: v.body,
      effectiveAt: v.effectiveAt ? new Date(v.effectiveAt).toISOString() : null,
      publishedAt: v.publishedAt ? new Date(v.publishedAt).toISOString() : null,
      changeSummary: v.changeSummary,
      orgLogoUrl: org.logoUrl,
    }
    if (subjectRef) {
      dto.reconsentRequired = !(await this.consents.hasAcceptedCurrent(
        key.orgId,
        subjectRef,
        v.contentHash
      ))
    }
    return dto
  }
}
