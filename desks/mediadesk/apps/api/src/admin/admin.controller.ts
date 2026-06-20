import {
  listAssetsQuerySchema,
  updateTenantSchema,
  type AssetListDto,
  type OverviewDto,
  type RotateKeysResultDto,
  type StorageInfoDto,
  type TenantDto,
  type UpdateTenantInput,
} from '@mediadesk/shared'
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'

import { AssetsService } from '../assets/assets.service'
import { AdminAuthGuard } from '../common/admin-auth.guard'
import { resolveBaseUrl } from '../common/base-url'
import { toTenantDto } from '../common/serialize'
import { ZodValidationPipe } from '../common/zod.pipe'
import { APP_CONFIG, type AppConfig } from '../config'
import { StorageService } from '../storage/storage.service'
import { TenantsService } from '../tenants/tenants.service'
import { TransformService } from '../transform/transform.service'
import { VisitsService } from '../visits/visits.service'

import type { TenantRequest } from '../common/request'
import type { Request } from 'express'

/**
 * 어드민 API — 테넌트 secret 키(X-Sk) 또는 마스터 토큰(X-Admin-Token)으로 인증한다
 * (AdminAuthGuard 가 req.tenant 를 해석해 붙인다). 자산 전체 관리·테넌트 설정·키 회전.
 */
@ApiTags('admin')
@ApiHeader({ name: 'X-Sk', required: false, description: '테넌트 secret 키(sk_…)' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '마스터 토큰' })
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly tenants: TenantsService,
    private readonly assets: AssetsService,
    private readonly storage: StorageService,
    private readonly transform: TransformService,
    private readonly visits: VisitsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 운영 지표(operator overview) ──────────────────────────────────────────────

  @Get('overview')
  @ApiOperation({
    summary: '운영 지표(마스터 토큰 전용) — 가입(실데이터) + 방문/트래픽(신규 집계)',
  })
  async overview(@Req() req: Request & TenantRequest): Promise<OverviewDto> {
    if (!req.isAdminMaster) {
      throw new BadRequestException('이 엔드포인트는 마스터 토큰(X-Admin-Token)이 필요합니다')
    }
    const [signups, traffic] = await Promise.all([this.tenants.signupStats(), this.visits.totals()])
    return {
      totalSignups: signups.total,
      todaySignups: signups.today,
      totalTraffic: traffic.totalTraffic,
      todayVisitors: traffic.todayVisitors,
      todayHits: traffic.todayHits,
      trafficSince: traffic.trafficSince,
    }
  }

  // ── 테넌트 ────────────────────────────────────────────────────────────────────

  @Get('me')
  @ApiOperation({ summary: '현재 인증된 테넌트(사용량 포함)' })
  me(@Req() req: Request & TenantRequest): TenantDto {
    this.requireTenant(req)
    return toTenantDto(this.cfg, req.tenant)
  }

  @Get('tenants')
  @ApiOperation({ summary: '모든 테넌트 목록(마스터 토큰 전용)' })
  listTenants(@Req() req: Request & TenantRequest): Promise<TenantDto[]> {
    if (!req.isAdminMaster) {
      throw new BadRequestException('이 엔드포인트는 마스터 토큰(X-Admin-Token)이 필요합니다')
    }
    return this.tenants.listTenants()
  }

  @Patch('tenant')
  @ApiOperation({ summary: '테넌트 설정 변경(이름·플랜·CORS 허용목록)' })
  update(
    @Req() req: Request & TenantRequest,
    @Body(new ZodValidationPipe(updateTenantSchema)) body: UpdateTenantInput
  ): Promise<TenantDto> {
    this.requireTenant(req)
    return this.tenants.updateTenant(req.tenant.id, body)
  }

  @Post('tenant/rotate-keys')
  @ApiOperation({ summary: '키 회전 — 새 pk_/sk_ 발급(이전 키 즉시 무효, sk_ 1회 노출)' })
  rotate(@Req() req: Request & TenantRequest): Promise<RotateKeysResultDto> {
    this.requireTenant(req)
    return this.tenants.rotateKeys(req.tenant.id)
  }

  @Get('storage')
  @ApiOperation({ summary: '스토리지 어댑터 정보 + 변환(sharp) 가용성' })
  storageInfo(): StorageInfoDto {
    return {
      driver: this.storage.driver,
      location: this.storage.describe(),
      transformAvailable: this.transform.available,
    }
  }

  // ── 자산(전체 관리) ────────────────────────────────────────────────────────────

  @Get('assets')
  @ApiOperation({ summary: '테넌트 자산 목록(폴더 필터·페이지네이션)' })
  listAssets(
    @Req() req: Request & TenantRequest,
    @Query(new ZodValidationPipe(listAssetsQuerySchema))
    query: { folder?: string; limit?: number; offset?: number }
  ): Promise<AssetListDto> {
    this.requireTenant(req)
    return this.assets.list(req.tenant, query, resolveBaseUrl(this.cfg, req))
  }

  @Get('folders')
  @ApiOperation({ summary: '테넌트의 폴더(논리 그룹) 목록' })
  listFolders(@Req() req: Request & TenantRequest): Promise<string[]> {
    this.requireTenant(req)
    return this.assets.listFolders(req.tenant)
  }

  @Delete('assets/*key')
  @ApiOperation({ summary: '자산 삭제(키로). 스토리지·DB·사용량 모두 반영' })
  deleteAsset(
    @Req() req: Request & TenantRequest,
    @Param('key') keyParam: string | string[]
  ): Promise<{ deleted: true; key: string }> {
    this.requireTenant(req)
    const key = Array.isArray(keyParam) ? keyParam.join('/') : keyParam
    return this.assets.delete(req.tenant, decodeURIComponent(key))
  }

  private requireTenant(req: Request & TenantRequest): void {
    if (!req.tenant) {
      throw new BadRequestException(
        '대상 테넌트가 지정되지 않았습니다. X-Tenant-Id 헤더를 보내거나 테넌트 secret 키(X-Sk)를 사용하세요.'
      )
    }
  }
}
