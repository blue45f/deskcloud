import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  aggregateReviews,
  type AdminReviewListDto,
  type AdminReviewQuery,
  type ModerateReviewInput,
  type PublicReviewsDto,
  type ReviewAggregate,
  type ReviewReceiptDto,
  type ReviewStatus,
  type ReviewWallDto,
  type SubmitReviewInput,
} from '@reviewdesk/shared'
import { and, desc, eq, sql, type SQL } from 'drizzle-orm'

import { toAdminReviewDto, toPublicReviewDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { reviews } from '../db/schema'
import { TenantsService, type TenantRow } from '../tenants/tenants.service'

const MAX_LIMIT = 100
const DEFAULT_PUBLIC_LIMIT = 20
const DEFAULT_ADMIN_LIMIT = 25

function clampLimit(limit: number | undefined, fallback: number): number {
  if (limit === undefined) return fallback
  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(limit)))
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 공개(publishable) ───────────────────────────────────────────────────────

  /**
   * 공개 리뷰 제출 — 무료 플랜 소프트 한도 검사 → 저장(테넌트 autoApprove 면 approved) →
   * usage 증가. 영수증(id·status)만 반환.
   */
  async submitReview(tenant: TenantRow, input: SubmitReviewInput): Promise<ReviewReceiptDto> {
    // 무료 플랜 소프트 한도: 누적 제출이 한도 이상이면 402.
    if (tenant.plan === 'free' && tenant.usageCount >= this.cfg.freePlanLimit) {
      throw new HttpException(
        {
          statusCode: HttpStatus.PAYMENT_REQUIRED,
          message: `무료 플랜 제출 한도(${this.cfg.freePlanLimit})를 초과했습니다. 플랜을 업그레이드하세요.`,
        },
        HttpStatus.PAYMENT_REQUIRED
      )
    }

    const status: ReviewStatus = tenant.autoApprove ? 'approved' : 'pending'

    const inserted = await this.dbs.db
      .insert(reviews)
      .values({
        tenantId: tenant.id,
        subjectId: input.subjectId,
        subjectLabel: input.subjectLabel ?? null,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        authorName: input.authorName,
        authorEmail: input.authorEmail ?? null,
        status,
        featured: false,
        source: input.source ?? null,
        meta: input.meta ?? null,
      })
      .returning()
    const row = inserted[0]!

    await this.tenants.incrementUsage(tenant.id)

    return {
      id: row.id,
      subjectId: row.subjectId,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    }
  }

  /** subject 의 승인본 리뷰 + 집계(표시 위젯). */
  async getPublicReviews(
    tenant: TenantRow,
    subjectId: string,
    limit?: number
  ): Promise<PublicReviewsDto> {
    const cap = clampLimit(limit, DEFAULT_PUBLIC_LIMIT)

    const rows = await this.dbs.db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.tenantId, tenant.id),
          eq(reviews.subjectId, subjectId),
          eq(reviews.status, 'approved')
        )
      )
      .orderBy(desc(reviews.featured), desc(reviews.createdAt))
      .limit(cap)

    const aggregate = await this.computeAggregate(tenant.id, subjectId)

    return {
      subjectId,
      items: rows.map(toPublicReviewDto),
      aggregate,
    }
  }

  /** 후기 월 — 승인 + 추천(featured) 리뷰(테넌트 전체, 최신순). */
  async getWall(tenant: TenantRow, limit?: number): Promise<ReviewWallDto> {
    const cap = clampLimit(limit, DEFAULT_PUBLIC_LIMIT)
    const rows = await this.dbs.db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.tenantId, tenant.id),
          eq(reviews.status, 'approved'),
          eq(reviews.featured, true)
        )
      )
      .orderBy(desc(reviews.createdAt))
      .limit(cap)
    return { items: rows.map(toPublicReviewDto) }
  }

  /** subject 별점 요약(배지용) — 승인본 기준 집계만. */
  async getAggregate(tenant: TenantRow, subjectId: string): Promise<ReviewAggregate> {
    return this.computeAggregate(tenant.id, subjectId)
  }

  /** 승인본 기준 별점 집계(순수 유틸 위임). */
  private async computeAggregate(tenantId: string, subjectId: string): Promise<ReviewAggregate> {
    const rows = await this.dbs.db
      .select({ rating: reviews.rating })
      .from(reviews)
      .where(
        and(
          eq(reviews.tenantId, tenantId),
          eq(reviews.subjectId, subjectId),
          eq(reviews.status, 'approved')
        )
      )
    return aggregateReviews(rows)
  }

  // ── 어드민(secret/글로벌 토큰) ───────────────────────────────────────────────

  /** 리뷰 목록(필터 + 페이지네이션, 최신순). 전체 필드(비공개 포함). */
  async listReviews(tenant: TenantRow, query: AdminReviewQuery): Promise<AdminReviewListDto> {
    const offset = Math.max(0, Math.trunc(query.offset ?? 0))
    const limit = clampLimit(query.limit, DEFAULT_ADMIN_LIMIT)

    const conditions: SQL[] = [eq(reviews.tenantId, tenant.id)]
    if (query.status) conditions.push(eq(reviews.status, query.status))
    if (query.subjectId) conditions.push(eq(reviews.subjectId, query.subjectId))
    if (query.featured !== undefined) conditions.push(eq(reviews.featured, query.featured))
    const where = and(...conditions)

    const totalRows = await this.dbs.db
      .select({ c: sql<number>`count(*)::int` })
      .from(reviews)
      .where(where)
    const total = Number(totalRows[0]?.c ?? 0)

    const rows = await this.dbs.db
      .select()
      .from(reviews)
      .where(where)
      .orderBy(desc(reviews.createdAt))
      .offset(offset)
      .limit(limit)

    return { items: rows.map(toAdminReviewDto), total, offset, limit }
  }

  /**
   * 검수 — approve|reject|feature|unfeature|reply. 상태 전이는 멱등(같은 상태로 재설정 무해).
   * feature 는 reject 상태에는 적용하지 않는다(승인본만 추천 가능).
   */
  async moderate(tenant: TenantRow, id: string, input: ModerateReviewInput): Promise<void> {
    const row = await this.findOwned(tenant.id, id)

    const patch: Partial<typeof reviews.$inferInsert> = {}
    switch (input.action) {
      case 'approve':
        patch.status = 'approved'
        break
      case 'reject':
        patch.status = 'rejected'
        // 거절본은 추천에서 내린다(후기 월 노출 방지).
        patch.featured = false
        break
      case 'feature':
        if (row.status !== 'approved') {
          throw new ForbiddenException('추천은 승인된 리뷰에만 적용할 수 있습니다')
        }
        patch.featured = true
        break
      case 'unfeature':
        patch.featured = false
        break
      case 'reply':
        // 빈 문자열이면 답글 삭제.
        patch.reply = input.reply && input.reply.length > 0 ? input.reply : null
        break
      default:
        break
    }

    await this.dbs.db
      .update(reviews)
      .set(patch)
      .where(and(eq(reviews.tenantId, tenant.id), eq(reviews.id, id)))
  }

  /** 리뷰 삭제. */
  async deleteReview(tenant: TenantRow, id: string): Promise<void> {
    await this.findOwned(tenant.id, id)
    await this.dbs.db
      .delete(reviews)
      .where(and(eq(reviews.tenantId, tenant.id), eq(reviews.id, id)))
  }

  /** 테넌트 소유 리뷰 조회(없거나 타 테넌트면 404). */
  private async findOwned(tenantId: string, id: string): Promise<typeof reviews.$inferSelect> {
    const rows = await this.dbs.db
      .select()
      .from(reviews)
      .where(and(eq(reviews.tenantId, tenantId), eq(reviews.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException('리뷰를 찾을 수 없습니다')
    return rows[0]
  }
}
