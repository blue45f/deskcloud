import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  createVersionSchema,
  publishVersionSchema,
  updateVersionSchema,
  type CreateVersionInput,
  type PolicyVersionDetailDto,
  type PolicyVersionSummaryDto,
  type PublishVersionInput,
  type UpdateVersionInput,
} from '@termsdesk/shared'

import { CurrentUser, RequirePermission } from '../auth/decorators'
import { SessionGuard } from '../auth/session.guard'
import { ZodValidationPipe } from '../common/zod.pipe'

import { VersionsService } from './versions.service'

import type { AuthUser } from '../common/request-context'

@ApiTags('versions')
@ApiBearerAuth('session')
@Controller('policies/:policyId/versions')
@UseGuards(SessionGuard)
export class VersionsController {
  constructor(private readonly versions: VersionsService) {}

  @Get()
  @RequirePermission('policy.read')
  @ApiOperation({ summary: '정책의 버전 타임라인' })
  list(
    @CurrentUser() user: AuthUser,
    @Param('policyId') policyId: string
  ): Promise<PolicyVersionSummaryDto[]> {
    return this.versions.listForPolicy(user.orgId, policyId)
  }

  @Post()
  @RequirePermission('version.create')
  @ApiOperation({ summary: '새 버전 초안 작성' })
  create(
    @CurrentUser() user: AuthUser,
    @Param('policyId') policyId: string,
    @Body(new ZodValidationPipe(createVersionSchema)) body: CreateVersionInput
  ): Promise<PolicyVersionDetailDto> {
    return this.versions.createDraft(user.orgId, user, policyId, body)
  }
}

@ApiTags('versions')
@ApiBearerAuth('session')
@Controller('versions')
@UseGuards(SessionGuard)
export class VersionItemController {
  constructor(private readonly versions: VersionsService) {}

  @Get(':versionId')
  @RequirePermission('policy.read')
  @ApiOperation({ summary: '버전 상세(본문 포함)' })
  get(
    @CurrentUser() user: AuthUser,
    @Param('versionId') versionId: string
  ): Promise<PolicyVersionDetailDto> {
    return this.versions.getVersion(user.orgId, versionId)
  }

  @Patch(':versionId')
  @RequirePermission('version.create')
  @ApiOperation({ summary: '초안 수정(게시본은 불변)' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(updateVersionSchema)) body: UpdateVersionInput
  ): Promise<PolicyVersionDetailDto> {
    return this.versions.updateDraft(user.orgId, user, versionId, body)
  }

  @Post(':versionId/publish')
  @RequirePermission('version.publish')
  @ApiOperation({ summary: '게시 — content_hash 동결, 현재 버전으로 승격' })
  publish(
    @CurrentUser() user: AuthUser,
    @Param('versionId') versionId: string,
    @Body(new ZodValidationPipe(publishVersionSchema)) body: PublishVersionInput
  ): Promise<PolicyVersionDetailDto> {
    return this.versions.publish(user.orgId, user, versionId, body)
  }
}
