import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import {
  type AuthConfigDto,
  googleAuthSchema,
  type GoogleAuthInput,
  loginSchema,
  type LoginInput,
  registerSchema,
  type RegisterInput,
  type SessionDto,
  updateProfileSchema,
  type UpdateProfileInput,
  withdrawAccountSchema,
  type WithdrawAccountInput,
} from '@termsdesk/shared'

import { ZodValidationPipe } from '../common/zod.pipe'

import { AuthService } from './auth.service'
import { ClientIp, CurrentUser } from './decorators'
import { SESSION_COOKIE, SessionGuard } from './session.guard'

import type { AuthUser } from '../common/request-context'
import type { Response } from 'express'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setSessionCookie(res: Response, token: string): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      // TLS 종단(https) 뒤에서만 true. http self-host/compose 데모에서도 동작하도록 env 분리.
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
      maxAge: SEVEN_DAYS_MS,
    })
  }

  @Get('config')
  @ApiOperation({ summary: '공개 인증 설정(가입 허용·Google 사용 가능 여부)' })
  config(): AuthConfigDto {
    return this.auth.authConfig()
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: '이메일/비밀번호 로그인 → 세션 쿠키 발급' })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<SessionDto> {
    const { token, session } = await this.auth.login(body, ip)
    this.setSessionCookie(res, token)
    return session
  }

  @Post('register')
  @HttpCode(201)
  @ApiOperation({ summary: '회원가입 — 새 조직+소유자 생성 → 세션 쿠키 발급' })
  async register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<SessionDto> {
    const { token, session } = await this.auth.register(body, ip)
    this.setSessionCookie(res, token)
    return session
  }

  @Post('demo')
  @HttpCode(200)
  @ApiOperation({ summary: '로그인 없이 둘러보기 — 읽기전용 데모 게스트 세션' })
  async demo(@Res({ passthrough: true }) res: Response): Promise<SessionDto> {
    const { token, session } = await this.auth.demoLogin()
    this.setSessionCookie(res, token)
    return session
  }

  @Post('google')
  @HttpCode(200)
  @ApiOperation({ summary: 'Google 로그인/가입 — ID 토큰 검증 → 세션 쿠키' })
  async google(
    @Body(new ZodValidationPipe(googleAuthSchema)) body: GoogleAuthInput,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<SessionDto> {
    const { token, session } = await this.auth.googleAuth(body, ip)
    this.setSessionCookie(res, token)
    return session
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: '로그아웃 → 세션 쿠키 제거' })
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    return { ok: true }
  }

  @Get('session')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: '현재 세션 정보' })
  session(@CurrentUser() user: AuthUser): Promise<SessionDto> {
    return this.auth.session(user.userId)
  }

  @Patch('profile')
  @UseGuards(SessionGuard)
  @ApiOperation({ summary: '내 프로필 수정(이름·이메일·비밀번호)' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
    @ClientIp() ip: string
  ): Promise<SessionDto> {
    return this.auth.updateProfile(user.userId, body, ip)
  }

  @Delete('account')
  @UseGuards(SessionGuard)
  @HttpCode(200)
  @ApiOperation({ summary: '내 계정 탈퇴(마지막 소유자 보호)' })
  async withdrawAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(withdrawAccountSchema)) body: WithdrawAccountInput,
    @ClientIp() ip: string,
    @Res({ passthrough: true }) res: Response
  ): Promise<{ ok: true }> {
    const result = await this.auth.withdrawAccount(user, body, ip)
    res.clearCookie(SESSION_COOKIE, { path: '/' })
    return result
  }
}
