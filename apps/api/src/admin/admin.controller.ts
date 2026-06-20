import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import {
  createTemplateSchema,
  updateTemplateSchema,
  updateTenantSchema,
  type CreateTemplateInput,
  type SentLogDto,
  type TemplateDto,
  type TenantCredentialsDto,
  type TenantDto,
  type UpdateTemplateInput,
  type UpdateTenantInput,
} from '@notifydesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { InboxService } from '../inbox/inbox.service'
import { TemplatesService } from '../notifications/templates.service'
import { SecretKeyGuard } from '../tenants/secret-key.guard'
import { getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'
import { TenantsService } from '../tenants/tenants.service'

import type { Response } from 'express'

/**
 * 어드민(secret 키 sk_ 또는 X-Admin-Token) — 템플릿 CRUD · 발송 로그 · 테넌트 조회/갱신 · 키 로테이션.
 *
 * 인증된 테넌트 컨텍스트(가드가 부착)에 대해 동작한다. ADMIN_TOKEN 경로는 ?tenantId 로 대상 지정.
 */
@ApiTags('admin (secret/admin-token)')
@ApiHeader({ name: 'Authorization', required: false, description: 'Bearer sk_… (secret 키)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '플랫폼 어드민 토큰(+ ?tenantId)' })
@Controller('admin')
@UseGuards(SecretKeyGuard)
export class AdminController {
  constructor(
    private readonly templates: TemplatesService,
    private readonly inbox: InboxService,
    private readonly tenants: TenantsService
  ) {}

  // ── 템플릿 CRUD ─────────────────────────────────────────────────────────────

  @Get('templates')
  @ApiOperation({ summary: '템플릿 목록(최신순)' })
  listTemplates(@Req() req: AuthedRequest): Promise<TemplateDto[]> {
    const { tenant } = getTenantCtx(req)
    return this.templates.list(tenant.id)
  }

  @Get('templates/:key')
  @ApiParam({ name: 'key', example: 'order.shipped' })
  @ApiOperation({ summary: '템플릿 단건' })
  getTemplate(@Req() req: AuthedRequest, @Param('key') key: string): Promise<TemplateDto> {
    const { tenant } = getTenantCtx(req)
    return this.templates.get(tenant.id, key)
  }

  @Post('templates')
  @ApiOperation({ summary: '템플릿 생성' })
  createTemplate(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(createTemplateSchema)) body: CreateTemplateInput
  ): Promise<TemplateDto> {
    const { tenant } = getTenantCtx(req)
    return this.templates.create(tenant.id, body)
  }

  @Put('templates/:key')
  @ApiParam({ name: 'key', example: 'order.shipped' })
  @ApiOperation({ summary: '템플릿 수정(전체 교체)' })
  updateTemplate(
    @Req() req: AuthedRequest,
    @Param('key') key: string,
    @Body(new ZodValidationPipe(updateTemplateSchema)) body: UpdateTemplateInput
  ): Promise<TemplateDto> {
    const { tenant } = getTenantCtx(req)
    return this.templates.update(tenant.id, key, body)
  }

  @Delete('templates/:key')
  @ApiParam({ name: 'key', example: 'order.shipped' })
  @ApiOperation({ summary: '템플릿 삭제' })
  removeTemplate(
    @Req() req: AuthedRequest,
    @Param('key') key: string
  ): Promise<{ deleted: boolean }> {
    const { tenant } = getTenantCtx(req)
    return this.templates.remove(tenant.id, key)
  }

  // ── 발송 로그 ───────────────────────────────────────────────────────────────

  @Get('sent')
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: '발송된 알림 로그(테넌트 전체, 최신순)' })
  async sentLog(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ): Promise<SentLogDto> {
    const { tenant } = getTenantCtx(req)
    const result = await this.inbox.sentLog(tenant.id, { offset, limit })
    res.setHeader('X-Total-Count', String(result.total))
    res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count')
    return result
  }

  // ── 테넌트 ──────────────────────────────────────────────────────────────────

  @Get('tenant')
  @ApiOperation({ summary: '내 테넌트 조회(secret 평문 미포함)' })
  getTenant(@Req() req: AuthedRequest): TenantDto {
    const { tenant } = getTenantCtx(req)
    return this.tenants.toDto(tenant)
  }

  @Put('tenant')
  @ApiOperation({ summary: '테넌트 설정 갱신(name·corsOrigins·plan)' })
  updateTenant(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    const { tenant } = getTenantCtx(req)
    return this.tenants.update(tenant.id, body)
  }

  @Post('tenant/rotate-keys')
  @HttpCode(200)
  @ApiOperation({ summary: '키 로테이션 — 새 pk_/sk_ 발급(secret 평문 1회 노출)' })
  rotateKeys(@Req() req: AuthedRequest): Promise<TenantCredentialsDto> {
    const { tenant } = getTenantCtx(req)
    return this.tenants.rotateKeys(tenant.id)
  }
}
