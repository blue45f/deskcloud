import {
  createTenantSchema,
  issueMemberTokenSchema,
  visitPingSchema,
  type CreateTenantInput,
  type IssueMemberTokenInput,
  type MemberTokenDto,
  type TenantWithSecretDto,
  type VisitPingInput,
  type VisitPingResultDto,
} from '@chatdesk/shared'
import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'

import { SecretKeyGuard } from './secret-key.guard'
import { TenantsService } from './tenants.service'

import type { AuthedRequest } from '../admin/admin-token.guard'

/** 공개 가입 — 외부 테넌트가 등록하고 pk·sk 키를 받는다. sk 평문은 응답 1회만. */
@ApiTags('tenants (public)')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenants: TenantsService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: '테넌트 가입 — pk(브라우저)·sk(서버) 키 발급. secret 키는 이 응답에서만 평문 노출',
  })
  signup(
    @Body(new ZodValidationPipe(createTenantSchema)) body: CreateTenantInput
  ): Promise<TenantWithSecretDto> {
    return this.tenants.create(body)
  }

  /**
   * 공개 방문 ping(브라우저 안전) — 위젯/SDK 가 호스트의 pk 로 fire-and-forget 호출한다.
   * pk(경로)로 테넌트를 해석하고 Origin 을 테넌트 CORS allowlist 에 대조한 뒤 일별 버킷에 누적.
   * sk 가 아니므로 비밀이 노출되지 않으며, 임베드 전에는 호출이 없어 트래픽이 0(정직한 0).
   */
  @Post(':pk/visit')
  @HttpCode(202)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @ApiParam({ name: 'pk', description: 'publishable 키(pk_…) — 브라우저 안전' })
  @ApiOperation({ summary: '방문 ping — pk·Origin 검증 후 일별 트래픽 버킷에 누적(고유/누적)' })
  async visit(
    @Param('pk') pk: string,
    @Headers('origin') origin: string | undefined,
    @Body(new ZodValidationPipe(visitPingSchema)) body: VisitPingInput
  ): Promise<VisitPingResultDto> {
    const tenant = await this.tenants.findByPublishableKey(pk)
    if (!tenant) throw new NotFoundException('유효한 publishable 키가 아닙니다')
    if (!this.tenants.isOriginAllowed(tenant, origin)) {
      throw new ForbiddenException(`Origin 이 허용되지 않습니다: ${origin ?? '(none)'}`)
    }
    return this.tenants.recordVisit(tenant.id, body)
  }
}

/** 멤버 토큰 발급(호스트 서버, sk) — 브라우저에 강화 인증 토큰을 내려줄 때 사용. */
@ApiTags('members (secret)')
@ApiHeader({ name: 'X-Chat-Key', required: true, description: 'secret 키(sk_…)' })
@Controller('members')
@UseGuards(SecretKeyGuard)
export class MembersController {
  constructor(private readonly tenants: TenantsService) {}

  @Post('token')
  @HttpCode(201)
  @ApiOperation({ summary: '멤버 토큰 발급 — pk 연결 시 강화 인증으로 제출(선택)' })
  issueToken(
    @Req() req: AuthedRequest,
    @Body(new ZodValidationPipe(issueMemberTokenSchema)) body: IssueMemberTokenInput
  ): MemberTokenDto {
    return this.tenants.issueMemberToken(req.tenant!, body.memberId, body.ttlSec)
  }
}
