import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { and, eq, ne, sql } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { hashPassword, randomUUID, verifyPassword } from '../common/crypto'
import { toMemberDto, toOrgDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { organizations, users } from '../db/schema'

import type { AuthUser } from '../common/request-context'
import type {
  AuthConfigDto,
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  SessionDto,
  UpdateProfileInput,
  WithdrawAccountInput,
} from '@termsdesk/shared'

@Injectable()
export class AuthService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async login(input: LoginInput, ip: string): Promise<{ token: string; session: SessionDto }> {
    const rows = await this.dbs.db
      .select()
      .from(users)
      .where(eq(users.email, input.email.toLowerCase()))
      .limit(1)
    const user = rows[0]
    if (!user || !user.passwordHash || !verifyPassword(input.password, user.passwordHash)) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다')
    }
    const orgRows = await this.dbs.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1)
    const org = orgRows[0]!

    const token = await this.jwt.signAsync({ sub: user.id, org: user.orgId })
    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.id,
      actorName: user.name,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      ip,
    })
    return {
      token,
      session: { user: toMemberDto(user), org: toOrgDto(org), mode: this.cfg.mode },
    }
  }

  async session(userId: string): Promise<SessionDto> {
    const rows = await this.dbs.db.select().from(users).where(eq(users.id, userId)).limit(1)
    const user = rows[0]
    if (!user) throw new UnauthorizedException()
    const orgRows = await this.dbs.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1)
    return { user: toMemberDto(user), org: toOrgDto(orgRows[0]!), mode: this.cfg.mode }
  }

  private async ownerCount(orgId: string): Promise<number> {
    const rows = await this.dbs.db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(and(eq(users.orgId, orgId), eq(users.role, 'owner')))
    return Number(rows[0]?.c ?? 0)
  }

  private assertPasswordVerified(user: typeof users.$inferSelect, password?: string): void {
    if (!user.passwordHash) {
      throw new BadRequestException(
        '소셜 로그인 계정은 비밀번호 확인이 필요한 변경을 할 수 없습니다'
      )
    }
    if (!password || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException('현재 비밀번호가 올바르지 않습니다')
    }
  }

  async updateProfile(userId: string, input: UpdateProfileInput, ip: string): Promise<SessionDto> {
    const rows = await this.dbs.db.select().from(users).where(eq(users.id, userId)).limit(1)
    const user = rows[0]
    if (!user) throw new UnauthorizedException()

    const nextEmail = input.email?.toLowerCase()
    const changes: string[] = []
    const patch: Partial<Pick<typeof users.$inferInsert, 'name' | 'email' | 'passwordHash'>> = {}

    if (input.name !== undefined && input.name !== user.name) {
      patch.name = input.name
      changes.push('이름 변경')
    }

    if (nextEmail !== undefined && nextEmail !== user.email) {
      this.assertPasswordVerified(user, input.currentPassword)
      const existing = await this.dbs.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, nextEmail), ne(users.id, user.id)))
        .limit(1)
      if (existing[0]) throw new ConflictException('이미 가입된 이메일입니다')
      patch.email = nextEmail
      changes.push('이메일 변경')
    }

    if (input.password !== undefined) {
      this.assertPasswordVerified(user, input.currentPassword)
      patch.passwordHash = hashPassword(input.password)
      changes.push('비밀번호 변경')
    }

    if (Object.keys(patch).length > 0) {
      await this.dbs.db.update(users).set(patch).where(eq(users.id, user.id))
      await this.audit.record({
        orgId: user.orgId,
        actorUserId: user.id,
        actorName: patch.name ?? user.name,
        action: 'auth.profile_updated',
        targetType: 'user',
        targetId: user.id,
        ip,
        metadata: { summary: changes.join(' · ') },
      })
    }

    return this.session(user.id)
  }

  async withdrawAccount(
    actor: AuthUser,
    input: WithdrawAccountInput,
    ip: string
  ): Promise<{ ok: true }> {
    const rows = await this.dbs.db.select().from(users).where(eq(users.id, actor.userId)).limit(1)
    const user = rows[0]
    if (!user) throw new UnauthorizedException()
    if (user.role === 'owner' && (await this.ownerCount(user.orgId)) <= 1) {
      throw new BadRequestException('마지막 소유자는 탈퇴할 수 없습니다')
    }
    if (user.passwordHash) this.assertPasswordVerified(user, input.currentPassword)

    await this.dbs.db.delete(users).where(eq(users.id, user.id))
    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.id,
      actorName: user.name,
      action: 'auth.account_withdrawn',
      targetType: 'user',
      targetId: user.id,
      ip,
      metadata: { summary: `계정 탈퇴: ${user.name} (${user.email})` },
    })
    return { ok: true }
  }

  /** 로그인/가입 화면이 노출할 인증 방식(공개). */
  authConfig(): AuthConfigDto {
    return {
      mode: this.cfg.mode,
      signupEnabled: this.cfg.allowSignup,
      googleEnabled: Boolean(this.cfg.googleClientId),
      googleClientId: this.cfg.googleClientId,
      demoEnabled: this.cfg.allowDemo,
    }
  }

  /** 셀프 회원가입 — 새 조직 + 첫 소유자 생성 후 즉시 세션 발급. */
  async register(
    input: RegisterInput,
    ip: string
  ): Promise<{ token: string; session: SessionDto }> {
    if (!this.cfg.allowSignup) {
      throw new ForbiddenException('이 서버는 셀프 회원가입이 비활성화되어 있습니다')
    }
    const email = input.email.toLowerCase()
    const existing = await this.dbs.db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)
    if (existing[0]) throw new ConflictException('이미 가입된 이메일입니다')

    const orgId = randomUUID()
    const slug = await this.uniqueOrgSlug(input.orgName)
    await this.dbs.db.insert(organizations).values({ id: orgId, name: input.orgName, slug })

    const userId = randomUUID()
    await this.dbs.db.insert(users).values({
      id: userId,
      orgId,
      email,
      name: input.name,
      passwordHash: hashPassword(input.password),
      provider: 'password',
      role: 'owner',
    })
    await this.audit.record({
      orgId,
      actorUserId: userId,
      actorName: input.name,
      action: 'org.created',
      targetType: 'org',
      targetId: orgId,
      ip,
      metadata: { summary: `회원가입: ${input.orgName} (${input.name})` },
    })

    const token = await this.jwt.signAsync({ sub: userId, org: orgId })
    return { token, session: await this.session(userId) }
  }

  /** 로그인 없이 둘러보기 — 격리된 데모 조직에 읽기전용 게스트 세션 발급. */
  async demoLogin(): Promise<{ token: string; session: SessionDto }> {
    if (!this.cfg.allowDemo) throw new ForbiddenException('데모가 비활성화되어 있습니다')
    const { ensureDemoOrg } = await import('./demo-seed')
    const { orgId, userId } = await ensureDemoOrg(this.dbs)
    const token = await this.jwt.signAsync({ sub: userId, org: orgId })
    return { token, session: await this.session(userId) }
  }

  /** Google ID 토큰(GIS) 검증 → 로그인/가입. google_sub 우선, 없으면 이메일로 계정 연결. */
  async googleAuth(
    input: GoogleAuthInput,
    ip: string
  ): Promise<{ token: string; session: SessionDto }> {
    const clientId = this.cfg.googleClientId
    if (!clientId) throw new ForbiddenException('Google 로그인이 설정되지 않았습니다')
    const { OAuth2Client } = await import('google-auth-library')
    const client = new OAuth2Client(clientId)
    let payload: import('google-auth-library').TokenPayload | undefined
    try {
      const ticket = await client.verifyIdToken({ idToken: input.credential, audience: clientId })
      payload = ticket.getPayload()
    } catch {
      throw new UnauthorizedException('Google 인증 토큰이 유효하지 않습니다')
    }
    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException('Google 계정 정보를 읽을 수 없습니다')
    }
    const sub = payload.sub
    const email = payload.email.toLowerCase()
    const name = payload.name ?? email.split('@')[0] ?? '사용자'

    let user = (await this.dbs.db.select().from(users).where(eq(users.googleSub, sub)).limit(1))[0]

    if (!user) {
      const byEmail = (
        await this.dbs.db.select().from(users).where(eq(users.email, email)).limit(1)
      )[0]
      if (byEmail) {
        // 기존(비번) 계정에 Google 연결.
        await this.dbs.db.update(users).set({ googleSub: sub }).where(eq(users.id, byEmail.id))
        user = byEmail
      } else {
        if (!this.cfg.allowSignup) throw new ForbiddenException('가입이 비활성화되어 있습니다')
        const orgId = randomUUID()
        const orgName = input.orgName?.trim() || `${name}의 조직`
        const slug = await this.uniqueOrgSlug(orgName)
        await this.dbs.db.insert(organizations).values({ id: orgId, name: orgName, slug })
        const userId = randomUUID()
        await this.dbs.db.insert(users).values({
          id: userId,
          orgId,
          email,
          name,
          provider: 'google',
          googleSub: sub,
          role: 'owner',
        })
        await this.audit.record({
          orgId,
          actorUserId: userId,
          actorName: name,
          action: 'org.created',
          targetType: 'org',
          targetId: orgId,
          ip,
          metadata: { summary: `Google 회원가입: ${orgName} (${name})` },
        })
        user = (await this.dbs.db.select().from(users).where(eq(users.id, userId)).limit(1))[0]!
      }
    }

    const token = await this.jwt.signAsync({ sub: user.id, org: user.orgId })
    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.id,
      actorName: user.name,
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      ip,
      metadata: { summary: 'Google 로그인' },
    })
    return { token, session: await this.session(user.id) }
  }

  /** orgName 으로 고유 slug 생성(비-ASCII 는 org-xxxx 폴백). */
  private async uniqueOrgSlug(name: string): Promise<string> {
    const base =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || `org-${randomUUID().slice(0, 8)}`
    let slug = base
    for (let i = 2; i < 1000; i++) {
      const hit = await this.dbs.db
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1)
      if (!hit[0]) return slug
      slug = `${base}-${i}`
    }
    return `${base}-${randomUUID().slice(0, 8)}`
  }
}
