import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { can, type Permission, type Role } from '@termsdesk/shared'
import { eq } from 'drizzle-orm'

import { DatabaseService } from '../db/database.service'
import { users } from '../db/schema'

import { PERMISSION_KEY } from './decorators'

import type { Request } from 'express'

export const SESSION_COOKIE = 'td_session'

/** 쿠키 JWT 검증 → req.authUser 주입. @RequirePermission 메타가 있으면 권한도 검사. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly dbs: DatabaseService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>()
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE]
    if (!token) throw new UnauthorizedException('로그인이 필요합니다')

    let payload: { sub: string }
    try {
      payload = await this.jwt.verifyAsync<{ sub: string }>(token)
    } catch {
      throw new UnauthorizedException('세션이 만료되었거나 유효하지 않습니다')
    }

    const rows = await this.dbs.db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    const user = rows[0]
    if (!user) throw new UnauthorizedException('사용자를 찾을 수 없습니다')

    req.authUser = {
      userId: user.id,
      orgId: user.orgId,
      role: user.role as Role,
      name: user.name,
      email: user.email,
    }

    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (permission && !can(user.role as Role, permission)) {
      throw new ForbiddenException(`권한이 없습니다 (${permission})`)
    }
    return true
  }
}
