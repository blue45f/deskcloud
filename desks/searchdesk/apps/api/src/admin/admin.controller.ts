import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Post,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import {
  updateTenantSchema,
  type DocumentListDto,
  type TenantCredentialsDto,
  type TenantDto,
  type UpdateTenantInput,
  type UsageDto,
} from '@searchdesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'
import { APP_CONFIG, type AppConfig } from '../config'
import { DocumentsService } from '../documents/documents.service'
import { SecretKeyGuard } from '../tenants/secret-key.guard'
import { getTenantCtx, type AuthedRequest } from '../tenants/tenant-context'
import { TenantsService } from '../tenants/tenants.service'

import type { Response } from 'express'

/**
 * 어드민(secret 키 sk_ 또는 X-Admin-Token) — 문서 목록 · 테넌트 조회/갱신 · 키 로테이션 · 사용량.
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
    private readonly documents: DocumentsService,
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 문서 ────────────────────────────────────────────────────────────────────

  @Get('docs')
  @ApiQuery({ name: 'index', required: false })
  @ApiQuery({ name: 'offset', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiOperation({ summary: '색인된 문서 목록(테넌트 전체 또는 인덱스 한정, 최신순)' })
  async listDocs(
    @Req() req: AuthedRequest,
    @Res({ passthrough: true }) res: Response,
    @Query('index') index?: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string
  ): Promise<DocumentListDto> {
    const { tenant } = getTenantCtx(req)
    const result = await this.documents.list(tenant, { offset, limit, index })
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

  // ── 사용량 ──────────────────────────────────────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: '사용량 — 누적 문서 수·검색 수·플랜 캡' })
  async usage(@Req() req: AuthedRequest): Promise<UsageDto> {
    const { tenant } = getTenantCtx(req)
    // 컨텍스트 테넌트는 인증 시점 스냅샷이므로, 최신 카운터를 다시 읽는다.
    const fresh = await this.tenants.getById(tenant.id)
    return {
      tenantId: fresh.id,
      plan: fresh.plan,
      docCount: fresh.docCount,
      docCap: fresh.plan === 'free' ? this.cfg.freePlanDocCap : null,
      searchCount: fresh.searchCount,
    }
  }
}
