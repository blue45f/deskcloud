import { isOriginAllowed, verifySecretKey } from '@changelogdesk/shared'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { tenants } from '../db/schema'

export type TenantRow = typeof tenants.$inferSelect

/** 어드민 인증 방식 — 글로벌 셀프호스트 토큰 vs 테넌트 시크릿 키. */
export type AdminAuthKind = 'admin-token' | 'secret-key'

export interface AdminAuthResult {
  kind: AdminAuthKind
  /** secret-key 인증이면 해당 테넌트, admin-token 이면 null(테넌트 비종속). */
  tenant: TenantRow | null
}

/**
 * 테넌트 인증·해석 로직(가드에서 호출하는 순수에 가까운 도우미).
 * 퍼블리시 키·시크릿 키 조회와 Origin/한도 판정을 한곳에 모은다.
 */
@Injectable()
export class TenantContextService {
  constructor(
    private readonly dbs: DatabaseService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /** 퍼블리시 키(pk_…)로 테넌트 조회. 없으면 null. */
  async findByPublishableKey(pk: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db
      .select()
      .from(tenants)
      .where(eq(tenants.publishableKey, pk))
      .limit(1)
    return rows[0] ?? null
  }

  /** slug 로 테넌트 조회. */
  async findBySlug(slug: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.slug, slug)).limit(1)
    return rows[0] ?? null
  }

  /** id(UUID)로 테넌트 조회. */
  async findById(id: string): Promise<TenantRow | null> {
    const rows = await this.dbs.db.select().from(tenants).where(eq(tenants.id, id)).limit(1)
    return rows[0] ?? null
  }

  /** 요청 Origin 이 테넌트 corsOrigins 허용 목록에 드는지. */
  isOriginAllowed(tenant: TenantRow, origin: string | undefined): boolean {
    return isOriginAllowed(origin, tenant.corsOrigins)
  }

  /** 글로벌 어드민 토큰 일치 여부. */
  matchesAdminToken(token: string | undefined): boolean {
    return !!token && token === this.cfg.adminToken
  }

  /**
   * 시크릿 키(sk_…)를 모든 테넌트 해시와 대조해 일치하는 테넌트를 찾는다.
   * (해시 저장이라 키→테넌트 역인덱스가 없어 전수 비교. 셀프호스트/소규모 가정.
   *  대규모면 키에 테넌트 식별 접두사를 넣어 후보를 좁히는 방식으로 확장 가능.)
   */
  async resolveSecretKey(sk: string): Promise<TenantRow | null> {
    const all = await this.dbs.db.select().from(tenants)
    for (const t of all) {
      if (verifySecretKey(sk, t.secretKeyHash)) return t
    }
    return null
  }

  /** free 플랜이면서 usageCount 가 월간 한도를 넘었는지(소프트). */
  isOverFreeLimit(tenant: TenantRow): boolean {
    return tenant.plan === 'free' && tenant.usageCount > this.cfg.freeMonthlyLimit
  }
}
