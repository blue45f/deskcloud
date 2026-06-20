import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import {
  createInquirySchema,
  inquiryCategories,
  inquiryStatuses,
  slugSchema,
  updateInquirySchema,
  type CreateInquiryInput,
  type InquiryCategory,
  type InquiryDto,
  type InquiryListDto,
  type InquiryReceiptDto,
  type InquiryStatus,
  type UpdateInquiryInput,
} from '@termsdesk/shared'
import { and, desc, eq, gte, sql, type SQL } from 'drizzle-orm'

import { AuditService } from '../common/audit.service'
import { randomUUID } from '../common/crypto'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { inquiries, organizations } from '../db/schema'
import { getPortfolioProject } from '../public/portfolio-legal'

import type { AuthUser } from '../common/request-context'

type InquiryRow = typeof inquiries.$inferSelect

/** `api/public/:siteSlug/...` URL 공간의 예약 세그먼트 — 문의 출처 slug 로 쓸 수 없다. */
const RESERVED_SITE_SLUGS = new Set(['support', 'embed.js', 'sitemap.xml'])

/** self-hosted 단일 조직 별칭 — public-render.service 의 DEFAULT_ORG_ALIASES 와 동일 전례. */
const DEFAULT_ORG_ALIASES = new Set(['_', 'default', 'org'])

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function badRequestFromIssues(issues: { path: PropertyKey[]; message: string }[]) {
  return new BadRequestException(
    issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
  )
}

function tooManyRequests(message: string) {
  return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS)
}

function normalizeStatus(value: unknown): InquiryStatus | undefined {
  if (value == null || value === '' || value === 'all') return undefined
  if (typeof value === 'string' && inquiryStatuses.includes(value as InquiryStatus)) {
    return value as InquiryStatus
  }
  throw new BadRequestException('문의 status 값이 올바르지 않습니다')
}

function normalizeCategory(value: unknown): InquiryCategory | undefined {
  if (value == null || value === '' || value === 'all') return undefined
  if (typeof value === 'string' && inquiryCategories.includes(value as InquiryCategory)) {
    return value as InquiryCategory
  }
  throw new BadRequestException('문의 category 값이 올바르지 않습니다')
}

function normalizeLimit(value: unknown): number {
  const raw = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 50
  if (!Number.isFinite(raw)) return 50
  return Math.min(Math.max(Math.trunc(raw), 1), 100)
}

function normalizeOffset(value: unknown): number {
  const raw = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : 0
  if (!Number.isFinite(raw)) return 0
  return Math.max(Math.trunc(raw), 0)
}

@Injectable()
export class InquiriesService {
  private readonly logger = new Logger('Inquiries')

  /**
   * 인메모리 슬라이딩 윈도우(접수 남용 방어 1차선).
   * 전제: EC2 단일 프로세스 배포 — 워커 간 공유가 없고 재시작 시 초기화되는 소프트 한도다.
   * DB 중복 검사(10분 내 동일 내용)가 2차 방어선으로 뒤를 받친다.
   */
  private readonly recentByIp = new Map<string, number[]>()
  private readonly recentBySite = new Map<string, number[]>()

  constructor(
    private readonly dbs: DatabaseService,
    private readonly audit: AuditService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  // ── 공개 접수 ────────────────────────────────────────────────────────────────

  async submit(
    rawSiteSlug: string,
    input: CreateInquiryInput,
    meta: { ip: string; userAgent?: string; origin?: string }
  ): Promise<InquiryReceiptDto> {
    const parsed = createInquirySchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)

    // ① 출처 사이트 해석 — 카탈로그 ∪ DB 조직 ∪ 기본 별칭. 그 외(예약어 포함)는 404.
    const { siteSlug, orgId } = await this.resolveSite(rawSiteSlug)

    // ② 허니팟 — 봇에게는 성공한 척 가짜 영수증만 돌려주고 저장하지 않는다.
    if (parsed.data.website) {
      this.logger.warn(`허니팟 감지 — 문의 폐기 (site=${siteSlug}, ip=${meta.ip})`)
      return {
        id: randomUUID(),
        siteSlug,
        category: parsed.data.category,
        status: 'new',
        createdAt: new Date().toISOString(),
      }
    }

    // ③ Origin 소프트 검증 — 목록이 비어 있으면 전부 허용, 헤더가 없으면 통과(서버 간 호출 허용).
    this.assertOriginAllowed(meta.origin)

    // ④ 인메모리 슬라이딩 윈도우 — ip 5/분·20/시, site 60/시.
    this.consumeRateBudget(siteSlug, meta.ip)

    // ⑤ DB 중복 — 같은 site+ip+제목+본문이 10분 내 이미 있으면 거부.
    const dupSince = new Date(Date.now() - 10 * MINUTE_MS)
    const dup = await this.dbs.db
      .select({ id: inquiries.id })
      .from(inquiries)
      .where(
        and(
          eq(inquiries.siteSlug, siteSlug),
          eq(inquiries.ip, meta.ip),
          eq(inquiries.title, parsed.data.title),
          eq(inquiries.body, parsed.data.body),
          gte(inquiries.createdAt, dupSince)
        )
      )
      .limit(1)
    if (dup[0])
      throw tooManyRequests('동일한 문의가 방금 접수되었습니다. 잠시 후 다시 시도해 주세요.')

    // ⑥ 저장 — 영수증(id)만 반환. 본문·연락처는 공개 응답으로 되돌려주지 않는다.
    const [row] = await this.dbs.db
      .insert(inquiries)
      .values({
        siteSlug,
        orgId,
        category: parsed.data.category,
        title: parsed.data.title,
        body: parsed.data.body,
        contactEmail: parsed.data.contactEmail ?? null,
        originUrl: parsed.data.originUrl || meta.origin || null,
        userAgent: meta.userAgent ? meta.userAgent.slice(0, 512) : null,
        ip: meta.ip,
      })
      .returning()

    const saved = row!
    return {
      id: saved.id,
      siteSlug: saved.siteSlug,
      category: saved.category as InquiryCategory,
      status: saved.status as InquiryStatus,
      createdAt: new Date(saved.createdAt).toISOString(),
    }
  }

  // ── 어드민 보드 ──────────────────────────────────────────────────────────────

  async list(
    user: AuthUser,
    filters: {
      status?: unknown
      category?: unknown
      site?: unknown
      offset?: unknown
      limit?: unknown
    } = {}
  ): Promise<InquiryListDto> {
    const status = normalizeStatus(filters.status)
    const category = normalizeCategory(filters.category)
    const limit = normalizeLimit(filters.limit)
    const offset = normalizeOffset(filters.offset)
    const scope = await this.visibleSiteScope(user)

    const conds: SQL[] = []
    if (scope) conds.push(eq(inquiries.siteSlug, scope))
    if (typeof filters.site === 'string' && filters.site.trim()) {
      // 스코프와 다른 site 를 요청하면 두 eq 가 교집합(빈 결과)이 된다 — 존재 여부를 누설하지 않음.
      conds.push(eq(inquiries.siteSlug, filters.site.trim().toLowerCase()))
    }
    if (status) conds.push(eq(inquiries.status, status))
    if (category) conds.push(eq(inquiries.category, category))
    const where = conds.length > 0 ? and(...conds) : undefined

    const [rows, totals] = await Promise.all([
      this.dbs.db
        .select()
        .from(inquiries)
        .where(where)
        .orderBy(desc(inquiries.createdAt))
        .limit(limit)
        .offset(offset),
      this.dbs.db
        .select({ c: sql<number>`count(*)` })
        .from(inquiries)
        .where(where),
    ])

    return { items: rows.map((row) => this.toDto(row)), total: Number(totals[0]?.c ?? 0) }
  }

  async getOne(user: AuthUser, id: string): Promise<InquiryDto> {
    const row = await this.getScopedRow(user, id)
    return this.toDto(row)
  }

  async update(user: AuthUser, id: string, input: UpdateInquiryInput): Promise<InquiryDto> {
    const parsed = updateInquirySchema.safeParse(input)
    if (!parsed.success) throw badRequestFromIssues(parsed.error.issues)
    const row = await this.getScopedRow(user, id)

    const changes: string[] = []
    if (parsed.data.status !== undefined && parsed.data.status !== row.status) {
      changes.push(`상태 ${row.status} → ${parsed.data.status}`)
    }
    if (parsed.data.adminNote !== undefined && parsed.data.adminNote !== row.adminNote) {
      changes.push(parsed.data.adminNote === null ? '메모 제거' : '메모 갱신')
    }

    const [updated] = await this.dbs.db
      .update(inquiries)
      .set({
        status: parsed.data.status ?? row.status,
        adminNote: parsed.data.adminNote === undefined ? row.adminNote : parsed.data.adminNote,
        updatedAt: new Date(),
      })
      .where(eq(inquiries.id, row.id))
      .returning()

    // 감사 이벤트는 처리자(조작 주체)의 조직에 귀속 — inquiry.org_id 는 NULL 일 수 있다.
    await this.audit.record({
      orgId: user.orgId,
      actorUserId: user.userId,
      actorName: user.name,
      action: 'inquiry.updated',
      targetType: 'inquiry',
      targetId: row.id,
      metadata: {
        summary: `문의 처리: ${row.title} (${row.siteSlug}) — ${
          changes.length > 0 ? changes.join(', ') : '변경 없음'
        }`,
      },
    })

    return this.toDto(updated!)
  }

  // ── 내부 ────────────────────────────────────────────────────────────────────

  /**
   * 출처 사이트 해석. 허용 집합 = 정적 포트폴리오 카탈로그 ∪ DB organizations.slug ∪ 기본 별칭.
   * DB 조직 매치 시 org_id 를 연결하고, 별칭은 기본(첫) 조직의 정식 slug 로 정규화해 저장한다.
   */
  private async resolveSite(rawSlug: string): Promise<{ siteSlug: string; orgId: string | null }> {
    const slug = rawSlug.trim().toLowerCase()
    if (!slug || RESERVED_SITE_SLUGS.has(slug)) {
      throw new NotFoundException('문의를 접수할 수 없는 사이트입니다')
    }

    if (DEFAULT_ORG_ALIASES.has(slug)) {
      const rows = await this.dbs.db
        .select()
        .from(organizations)
        .orderBy(organizations.createdAt)
        .limit(1)
      const org = rows[0]
      if (!org) throw new NotFoundException('문의를 접수할 수 없는 사이트입니다')
      return { siteSlug: org.slug, orgId: org.id }
    }

    if (!slugSchema.safeParse(slug).success) {
      throw new NotFoundException('문의를 접수할 수 없는 사이트입니다')
    }

    const orgRows = await this.dbs.db
      .select()
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1)
    if (orgRows[0]) return { siteSlug: slug, orgId: orgRows[0].id }

    if (getPortfolioProject(slug)) return { siteSlug: slug, orgId: null }

    throw new NotFoundException('문의를 접수할 수 없는 사이트입니다')
  }

  private assertOriginAllowed(origin: string | undefined): void {
    const allowed = this.cfg.inquiryAllowedOrigins
    if (!origin || allowed.length === 0) return
    const normalized = origin.trim().replace(/\/$/, '').toLowerCase()
    if (!allowed.includes(normalized)) {
      throw new ForbiddenException('허용되지 않은 출처(Origin)의 접수입니다')
    }
  }

  /** 1시간 창 밖 기록을 버린 타임스탬프 배열을 돌려준다(빈 키는 제거해 맵 비대화 방지). */
  private static pruned(map: Map<string, number[]>, key: string, now: number): number[] {
    const kept = (map.get(key) ?? []).filter((t) => t > now - HOUR_MS)
    if (kept.length === 0) map.delete(key)
    else map.set(key, kept)
    return kept
  }

  private consumeRateBudget(siteSlug: string, ip: string): void {
    const now = Date.now()
    // 오래 안 본 키가 쌓이지 않게 가끔 전체 청소(단일 프로세스 전제라 비용 미미).
    if (this.recentByIp.size > 5000 || this.recentBySite.size > 5000) {
      for (const m of [this.recentByIp, this.recentBySite]) {
        for (const key of m.keys()) InquiriesService.pruned(m, key, now)
      }
    }

    const ipHits = InquiriesService.pruned(this.recentByIp, ip, now)
    const siteHits = InquiriesService.pruned(this.recentBySite, siteSlug, now)
    const ipPerMinute = ipHits.filter((t) => t > now - MINUTE_MS).length

    if (ipPerMinute >= 5 || ipHits.length >= 20 || siteHits.length >= 60) {
      throw tooManyRequests('접수 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.')
    }

    this.recentByIp.set(ip, [...ipHits, now])
    this.recentBySite.set(siteSlug, [...siteHits, now])
  }

  /**
   * v1 가시성 전제(의도적 단순화):
   * - 기본(첫 생성) 조직 멤버 = 포트폴리오 운영자 → 전체 문의 열람/관리 (반환 null = 무제한)
   * - 그 외 조직 멤버 → site_slug 가 자기 조직 slug 인 문의만 (반환 = 그 slug)
   * 조직↔사이트 매핑 테이블이 생기면 그쪽으로 이관한다.
   */
  private async visibleSiteScope(user: AuthUser): Promise<string | null> {
    const firstRows = await this.dbs.db
      .select()
      .from(organizations)
      .orderBy(organizations.createdAt)
      .limit(1)
    if (firstRows[0]?.id === user.orgId) return null

    const ownRows = await this.dbs.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, user.orgId))
      .limit(1)
    const own = ownRows[0]
    if (!own) throw new ForbiddenException('소속 조직을 확인할 수 없습니다')
    return own.slug
  }

  private async getScopedRow(user: AuthUser, id: string): Promise<InquiryRow> {
    // uuid 가 아니면 드라이버 캐스팅 오류 대신 동일한 404 로 처리.
    if (!UUID_RE.test(id)) throw new NotFoundException('문의를 찾을 수 없습니다')
    const rows = await this.dbs.db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1)
    const row = rows[0]
    const scope = await this.visibleSiteScope(user)
    // 스코프 밖 문의는 존재 여부를 드러내지 않도록 동일한 404.
    if (!row || (scope && row.siteSlug !== scope)) {
      throw new NotFoundException('문의를 찾을 수 없습니다')
    }
    return row
  }

  private toDto(row: InquiryRow): InquiryDto {
    return {
      id: row.id,
      siteSlug: row.siteSlug,
      orgId: row.orgId,
      category: row.category as InquiryCategory,
      status: row.status as InquiryStatus,
      title: row.title,
      body: row.body,
      contactEmail: row.contactEmail,
      originUrl: row.originUrl,
      userAgent: row.userAgent,
      ip: row.ip,
      adminNote: row.adminNote,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }
  }
}
