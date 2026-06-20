import {
  updateTenantSettingsSchema,
  type TenantAnalyticsDto,
  type TenantDto,
  type TenantUsage,
  type TenantWithSecretDto,
  type UpdateTenantSettingsInput,
} from '@chatdesk/shared'
import {
  Body,
  Controller,
  Get,
  Put,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'

import { ZodValidationPipe } from '../common/zod.pipe'
import { TenantsService } from '../tenants/tenants.service'

import { AdminGuard, type AuthedRequest } from './admin-token.guard'

/**
 * 어드민(테넌트 self-service) — 내 테넌트 조회·설정 수정·키 회전·사용량.
 * secret 키 또는 전역 X-Admin-Token 으로 통과. 테넌트 식별엔 sk 가 필요.
 */
@ApiTags('admin (tenant)')
@ApiHeader({ name: 'X-Chat-Key', required: false, description: 'secret 키(sk_…) — 테넌트 식별' })
@ApiHeader({ name: 'X-Admin-Token', required: false, description: '전역 어드민 토큰' })
@Controller('admin/tenant')
@UseGuards(AdminGuard)
export class AdminTenantController {
  constructor(private readonly tenants: TenantsService) {}

  private requireTenantId(req: AuthedRequest): string {
    if (req.tenant) return req.tenant.id
    throw new UnauthorizedException('테넌트 식별을 위해 secret 키(X-Chat-Key: sk_…)가 필요합니다')
  }

  @Get()
  @ApiOperation({ summary: '내 테넌트 단건(키·사용량). secret 키 해시는 노출하지 않음' })
  getTenant(@Req() req: AuthedRequest): Promise<TenantDto> {
    return this.tenants.getDto(this.requireTenantId(req))
  }

  @Get('usage')
  @ApiOperation({ summary: '사용량(messages·cap)' })
  getUsage(@Req() req: AuthedRequest): Promise<TenantUsage> {
    return this.tenants.getUsage(this.requireTenantId(req))
  }

  @Get('analytics')
  @ApiOperation({
    summary:
      '트래픽·가입 분석 — 오늘 방문자·총 트래픽(추적값, 위젯 임베드 후 집계) + 오늘/총 신규 가입(실측)',
  })
  getAnalytics(@Req() req: AuthedRequest): Promise<TenantAnalyticsDto> {
    return this.tenants.getAnalytics(this.requireTenantId(req))
  }

  @Put()
  @ApiOperation({ summary: '테넌트 설정 수정(이름·허용 Origin·요금제). 보낸 필드만 갱신' })
  updateSettings(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(updateTenantSettingsSchema)) body: UpdateTenantSettingsInput
  ): Promise<TenantDto> {
    return this.tenants.updateSettings(this.requireTenantId(req), body)
  }

  @Post('rotate-keys')
  @ApiOperation({ summary: '키 회전 — 새 pk·sk 발급. 이전 키는 즉시 무효. sk 평문 1회 노출' })
  rotateKeys(@Req() req: AuthedRequest): Promise<TenantWithSecretDto> {
    return this.tenants.rotateKeys(this.requireTenantId(req))
  }
}
