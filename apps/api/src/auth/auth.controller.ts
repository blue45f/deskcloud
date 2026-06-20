import {
  loginSchema,
  registerSchema,
  userListQuerySchema,
  visitSchema,
  type AuthResultDto,
  type AuthStatsDto,
  type EndUserDto,
  type LoginInput,
  type LogoutResultDto,
  type RegisterInput,
  type TrackVisitResultDto,
  type UsageSummaryDto,
  type UserListDto,
  type UserListQuery,
  type VisitInput,
} from '@authdesk/shared'
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'

import { ZodValidationPipe } from '../common/zod.pipe'
import { PublishableKeyGuard } from '../tenants/publishable-key.guard'
import { SecretKeyGuard, tenantOf } from '../tenants/secret-key.guard'

import { AuthService } from './auth.service'
import { EndUserGuard, endUserOf } from './end-user.guard'

import type { Request } from 'express'

/**
 * end-user 인증 API — 테넌트 풀의 최종 사용자 가입/로그인/세션 + 어드민 사용자/통계.
 *
 *  - 공개(publishable 키 + Origin):  POST /auth/register · POST /auth/login
 *  - end-user 세션(Bearer JWT):      GET  /auth/me · POST /auth/logout
 *  - 어드민(secret 키):              GET  /auth/users · DELETE /auth/users/:id · GET /auth/stats
 *
 * 인증 라우트(register/login)는 throttler 로 추가 rate-limit 한다(자격증명 무차별 방어).
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ── 공개(publishable 키 + Origin) ───────────────────────────────────────────

  @Post('register')
  @HttpCode(201)
  @UseGuards(PublishableKeyGuard)
  @ApiHeader({ name: 'X-Authdesk-Key', required: true, description: 'publishable 키(pk_…)' })
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'end-user 가입 — 사용자 + 액세스 토큰(JWT) 반환' })
  register(
    @Req() req: Request,
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput
  ): Promise<AuthResultDto> {
    return this.auth.register(tenantOf(req), body)
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(PublishableKeyGuard)
  @ApiHeader({ name: 'X-Authdesk-Key', required: true, description: 'publishable 키(pk_…)' })
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'end-user 로그인 — 사용자 + 액세스 토큰(JWT) 반환' })
  login(
    @Req() req: Request,
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput
  ): Promise<AuthResultDto> {
    return this.auth.login(tenantOf(req), body)
  }

  @Post('visit')
  @HttpCode(200)
  @UseGuards(PublishableKeyGuard)
  @ApiHeader({ name: 'X-Authdesk-Key', required: true, description: 'publishable 키(pk_…)' })
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '방문 핑 — 트래픽/고유 방문자 집계(fire-and-forget)' })
  trackVisit(
    @Req() req: Request,
    @Body(new ZodValidationPipe(visitSchema)) body: VisitInput
  ): Promise<TrackVisitResultDto> {
    // vid 가 없으면 IP 로 폴백해 고유 방문자를 근사한다(원문 IP/vid 는 저장하지 않고 해시만).
    return this.auth.trackVisit(tenantOf(req), body.vid, req.ip)
  }

  // ── end-user 세션(Bearer JWT) ───────────────────────────────────────────────

  @Get('me')
  @UseGuards(EndUserGuard)
  @ApiBearerAuth('endUserToken')
  @ApiOperation({ summary: '현재 로그인한 end-user 조회 (Authorization: Bearer <JWT>)' })
  me(@Req() req: Request): Promise<EndUserDto> {
    return this.auth.me(endUserOf(req))
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(EndUserGuard)
  @ApiBearerAuth('endUserToken')
  @ApiOperation({ summary: '로그아웃 — 현재 세션(jti) 폐기' })
  async logout(@Req() req: Request): Promise<LogoutResultDto> {
    await this.auth.logout(endUserOf(req))
    return { ok: true }
  }

  // ── 어드민(secret 키) ───────────────────────────────────────────────────────

  @Get('users')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: 'end-user 목록 — 페이지네이션·이메일 검색 (sk_)' })
  listUsers(
    @Req() req: Request,
    @Query(new ZodValidationPipe(userListQuerySchema)) query: UserListQuery
  ): Promise<UserListDto> {
    return this.auth.listUsers(tenantOf(req).id, query)
  }

  @Delete('users/:id')
  @HttpCode(200)
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: 'end-user 삭제 — 세션도 함께 폐기 (sk_)' })
  async deleteUser(
    @Req() req: Request,
    @Param('id') id: string
  ): Promise<{ deleted: true; id: string }> {
    await this.auth.deleteUser(tenantOf(req).id, id)
    return { deleted: true, id }
  }

  @Get('stats')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: '사용자 통계 — 수·가입(7d/30d)·로그인·verified (sk_)' })
  stats(@Req() req: Request): Promise<AuthStatsDto> {
    const tenant = tenantOf(req)
    return this.auth.stats(tenant.id, tenant.plan)
  }

  @Get('usage')
  @UseGuards(SecretKeyGuard)
  @ApiBearerAuth('secretKey')
  @ApiOperation({ summary: '사용량 요약 — 메트릭별 used/limit/remaining (sk_)' })
  usage(@Req() req: Request): Promise<UsageSummaryDto> {
    const tenant = tenantOf(req)
    return this.auth.usage(tenant.id, tenant.plan)
  }
}
