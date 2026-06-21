import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { can } from '@termsdesk/shared'
import { and, asc, eq } from 'drizzle-orm'

import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { organizations, requestProposals, serviceRequests, users } from '../db/schema'

import type { AuthUser } from '../common/request-context'
import type { Role } from '@termsdesk/shared'
import type { Request } from 'express'

const REALTIME_TOKEN_TTL_MS = 5 * 60 * 1000

interface RealtimeTokenPayload {
  sub: string
  org?: string
  purpose?: string
}

@Injectable()
export class RealtimeAuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  async issueToken(user: AuthUser): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + REALTIME_TOKEN_TTL_MS)
    const token = await this.jwt.signAsync(
      { sub: user.userId, org: user.orgId, purpose: 'realtime' },
      { expiresIn: `${REALTIME_TOKEN_TTL_MS / 1000}s` }
    )
    return { token, expiresAt }
  }

  async authenticateToken(token: string): Promise<AuthUser | null> {
    let payload: RealtimeTokenPayload
    try {
      payload = await this.jwt.verifyAsync<RealtimeTokenPayload>(token)
    } catch {
      return null
    }
    if (payload.purpose && payload.purpose !== 'realtime') return null

    const rows = await this.dbs.db.select().from(users).where(eq(users.id, payload.sub)).limit(1)
    const user = rows[0]
    if (!user) return null

    return {
      userId: user.id,
      orgId: user.orgId,
      role: user.role as Role,
      name: user.name,
      email: user.email,
    }
  }

  async canJoinRequest(user: AuthUser, requestId: string): Promise<boolean> {
    if (!requestId) return false
    const requestRows = await this.dbs.db
      .select()
      .from(serviceRequests)
      .where(eq(serviceRequests.id, requestId))
      .limit(1)
    const row = requestRows[0]
    if (!row) return false
    if (String(row.requesterOrgId) === user.orgId) return true
    if (row.assignedProviderUserId && String(row.assignedProviderUserId) === user.userId) {
      return true
    }
    if (await this.isPlatformAdmin(user)) return true

    const proposalRows = await this.dbs.db
      .select({ id: requestProposals.id })
      .from(requestProposals)
      .where(
        and(
          eq(requestProposals.requestId, requestId),
          eq(requestProposals.providerUserId, user.userId)
        )
      )
      .limit(1)
    return Boolean(proposalRows[0])
  }

  realtimeOrigin(req: Request): string {
    if (this.cfg.realtimeOrigin) return this.cfg.realtimeOrigin

    const host = req.get('host') ?? 'localhost:4070'
    const forwardedProto = req.get('x-forwarded-proto')
    const proto =
      forwardedProto === 'https' || (!host.startsWith('localhost') && !host.startsWith('127.0.0.1'))
        ? 'https'
        : 'http'
    return `${proto}://${host}`.replace(/\/$/, '')
  }

  private async isPlatformAdmin(user: AuthUser): Promise<boolean> {
    if (!can(user.role, 'member.manage')) return false
    const firstRows = await this.dbs.db
      .select({ id: organizations.id })
      .from(organizations)
      .orderBy(asc(organizations.createdAt))
      .limit(1)
    return firstRows[0]?.id === user.orgId
  }
}
