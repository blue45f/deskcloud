import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  base64ByteLength,
  computeStats,
  isBotUserAgent,
  isCampaignServable,
  parseImageData,
  pickWeighted,
  primarySize,
  type CampaignDto,
  type UploadImageInput,
  type CreateCampaignInput,
  type CreateCreativeInput,
  type CreateSlotInput,
  type CreativeDto,
  type ServeDto,
  type SlotDto,
  type StatsDto,
  type TrackReceiptDto,
  type UpdateCampaignInput,
  type UpdateCreativeInput,
  type UpdateSlotInput,
} from '@addesk/shared'
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, gte, sql } from 'drizzle-orm'

import { toCampaignDto, toCreativeDto, toSlotDto } from '../common/serialize'
import { APP_CONFIG, type AppConfig } from '../config'
import { DatabaseService } from '../db/database.service'
import { adUploads, adVisits, campaigns, creatives, slots } from '../db/schema'
import { TenantsService } from '../tenants/tenants.service'

type CampaignRow = typeof campaigns.$inferSelect
type CreativeRow = typeof creatives.$inferSelect

/** 서빙 한도 검사·증가에 필요한 테넌트 최소 정보. */
interface ServingTenant {
  id: string
  plan: string
  usageCount: number
}

@Injectable()
export class AdsService {
  constructor(
    private readonly dbs: DatabaseService,
    private readonly tenants: TenantsService,
    @Inject(APP_CONFIG) private readonly cfg: AppConfig
  ) {}

  /* ── 캠페인 CRUD ───────────────────────────────────────────────────────── */

  async createCampaign(tenantId: string, input: CreateCampaignInput): Promise<CampaignDto> {
    const inserted = await this.dbs.db
      .insert(campaigns)
      .values({
        tenantId,
        name: input.name,
        status: input.status,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      })
      .returning()
    return toCampaignDto(inserted[0]!)
  }

  async listCampaigns(tenantId: string): Promise<CampaignDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.tenantId, tenantId))
      .orderBy(sql`${campaigns.createdAt} DESC`)
    return rows.map(toCampaignDto)
  }

  async getCampaign(tenantId: string, id: string): Promise<CampaignDto> {
    return toCampaignDto(await this.requireCampaign(tenantId, id))
  }

  async updateCampaign(
    tenantId: string,
    id: string,
    input: UpdateCampaignInput
  ): Promise<CampaignDto> {
    await this.requireCampaign(tenantId, id)
    const patch: Partial<typeof campaigns.$inferInsert> = { updatedAt: new Date() }
    if (input.name != null) patch.name = input.name
    if (input.status != null) patch.status = input.status
    if (input.startsAt !== undefined)
      patch.startsAt = input.startsAt ? new Date(input.startsAt) : null
    if (input.endsAt !== undefined) patch.endsAt = input.endsAt ? new Date(input.endsAt) : null
    const updated = await this.dbs.db
      .update(campaigns)
      .set(patch)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)))
      .returning()
    return toCampaignDto(updated[0]!)
  }

  /** 캠페인 삭제 — 소속 크리에이티브도 함께 제거(고아 방지). */
  async deleteCampaign(tenantId: string, id: string): Promise<{ deleted: boolean; id: string }> {
    await this.requireCampaign(tenantId, id)
    await this.dbs.db
      .delete(creatives)
      .where(and(eq(creatives.tenantId, tenantId), eq(creatives.campaignId, id)))
    await this.dbs.db
      .delete(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)))
    return { deleted: true, id }
  }

  /* ── 크리에이티브 CRUD ─────────────────────────────────────────────────── */

  async createCreative(tenantId: string, input: CreateCreativeInput): Promise<CreativeDto> {
    // 크리에이티브는 같은 테넌트의 캠페인에만 속할 수 있다.
    await this.requireCampaign(tenantId, input.campaignId)
    // slotKey 는 실재하는 슬롯을 가리켜야 한다 — 오타/유령 슬롯이면 영영 서빙되지 않으므로 거절.
    await this.requireSlotKey(tenantId, input.slotKey)
    const inserted = await this.dbs.db
      .insert(creatives)
      .values({
        tenantId,
        campaignId: input.campaignId,
        slotKey: input.slotKey,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl,
        alt: input.alt,
        weight: input.weight,
      })
      .returning()
    return toCreativeDto(inserted[0]!)
  }

  /** 크리에이티브 목록(선택적으로 캠페인/슬롯으로 필터). */
  async listCreatives(
    tenantId: string,
    filter: { campaignId?: string; slotKey?: string } = {}
  ): Promise<CreativeDto[]> {
    const conds = [eq(creatives.tenantId, tenantId)]
    if (filter.campaignId) conds.push(eq(creatives.campaignId, filter.campaignId))
    if (filter.slotKey) conds.push(eq(creatives.slotKey, filter.slotKey))
    const rows = await this.dbs.db
      .select()
      .from(creatives)
      .where(and(...conds))
      .orderBy(sql`${creatives.createdAt} DESC`)
    return rows.map(toCreativeDto)
  }

  async getCreative(tenantId: string, id: string): Promise<CreativeDto> {
    return toCreativeDto(await this.requireCreative(tenantId, id))
  }

  async updateCreative(
    tenantId: string,
    id: string,
    input: UpdateCreativeInput
  ): Promise<CreativeDto> {
    await this.requireCreative(tenantId, id)
    // 슬롯 이동 시에도 대상 slotKey 가 실재하는 슬롯을 가리켜야 한다(유령 슬롯 이동 차단).
    if (input.slotKey != null) await this.requireSlotKey(tenantId, input.slotKey)
    const patch: Partial<typeof creatives.$inferInsert> = { updatedAt: new Date() }
    if (input.slotKey != null) patch.slotKey = input.slotKey
    if (input.imageUrl != null) patch.imageUrl = input.imageUrl
    if (input.linkUrl != null) patch.linkUrl = input.linkUrl
    if (input.alt != null) patch.alt = input.alt
    if (input.weight != null) patch.weight = input.weight
    const updated = await this.dbs.db
      .update(creatives)
      .set(patch)
      .where(and(eq(creatives.tenantId, tenantId), eq(creatives.id, id)))
      .returning()
    return toCreativeDto(updated[0]!)
  }

  async deleteCreative(tenantId: string, id: string): Promise<{ deleted: boolean; id: string }> {
    await this.requireCreative(tenantId, id)
    await this.dbs.db
      .delete(creatives)
      .where(and(eq(creatives.tenantId, tenantId), eq(creatives.id, id)))
    return { deleted: true, id }
  }

  /* ── 슬롯 CRUD ─────────────────────────────────────────────────────────── */

  async createSlot(tenantId: string, input: CreateSlotInput): Promise<SlotDto> {
    const dup = await this.dbs.db
      .select({ id: slots.id })
      .from(slots)
      .where(and(eq(slots.tenantId, tenantId), eq(slots.key, input.key)))
      .limit(1)
    if (dup.length > 0) {
      throw new BadRequestException(`슬롯 key '${input.key}' 가 이미 존재합니다`)
    }
    const inserted = await this.dbs.db
      .insert(slots)
      .values({
        tenantId,
        key: input.key,
        label: input.label ?? null,
        sizes: input.sizes,
      })
      .returning()
    return toSlotDto(inserted[0]!)
  }

  async listSlots(tenantId: string): Promise<SlotDto[]> {
    const rows = await this.dbs.db
      .select()
      .from(slots)
      .where(eq(slots.tenantId, tenantId))
      .orderBy(sql`${slots.createdAt} DESC`)
    return rows.map(toSlotDto)
  }

  async updateSlot(tenantId: string, id: string, input: UpdateSlotInput): Promise<SlotDto> {
    await this.requireSlot(tenantId, id)
    const patch: Partial<typeof slots.$inferInsert> = { updatedAt: new Date() }
    if (input.label !== undefined) patch.label = input.label ?? null
    if (input.sizes != null) patch.sizes = input.sizes
    const updated = await this.dbs.db
      .update(slots)
      .set(patch)
      .where(and(eq(slots.tenantId, tenantId), eq(slots.id, id)))
      .returning()
    return toSlotDto(updated[0]!)
  }

  async deleteSlot(tenantId: string, id: string): Promise<{ deleted: boolean; id: string }> {
    await this.requireSlot(tenantId, id)
    await this.dbs.db.delete(slots).where(and(eq(slots.tenantId, tenantId), eq(slots.id, id)))
    return { deleted: true, id }
  }

  /* ── 공개 서빙 · 트래킹 ────────────────────────────────────────────────── */

  /**
   * 슬롯에 노출할 활성 크리에이티브 1개를 가중 랜덤 선택해 반환한다.
   * - 슬롯의 크리에이티브 중 서빙 가능한 캠페인(active + 기간 내)만 후보로 둔다.
   * - 후보가 없으면 served:false(위젯은 아무것도 그리지 않는다).
   * - 무료 플랜 누적 서빙 한도를 초과하면 402.
   * - 서빙 1건마다 테넌트 usageCount 를 증가시킨다(서빙된 경우에만).
   *
   * 무료 플랜 한도는 read-snapshot 이 아니라 원자적 조건부 증가로 강제한다 — 가드가 적재한
   * usageCount 는 cheap 한 1차 거절일 뿐이고, 동시 서빙의 TOCTOU 오버슈트는 incrementUsageUnder()
   * 의 `UPDATE … WHERE usage_count < limit RETURNING` 가 막는다(증가 실패 시 402).
   */
  async serve(
    tenant: ServingTenant,
    slotKey: string,
    rng: () => number = Math.random,
    now: Date = new Date()
  ): Promise<ServeDto> {
    const free = tenant.plan === 'free'
    // 1차(cheap) 거절 — 가드가 적재한 스냅샷이 이미 한도면 후보 조회조차 생략.
    if (free && tenant.usageCount >= this.cfg.freePlanLimit) {
      throw this.freePlanCapExceeded()
    }

    // 후보와 슬롯 행을 함께 적재 — size 힌트를 위한 별도 조회를 없앤다(핫패스 1 라운드트립 절약).
    const { candidates, sizes } = await this.servableCreatives(tenant.id, slotKey, now)
    const picked = pickWeighted(
      candidates.map((c) => ({ id: c.id, weight: c.weight })),
      rng
    )
    if (!picked) {
      return {
        served: false,
        creativeId: null,
        imageUrl: null,
        linkUrl: null,
        alt: null,
        size: null,
      }
    }
    const creative = candidates.find((c) => c.id === picked.id)!

    // 서빙 확정 시에만 카운터 증가(빈 응답은 미과금). 무료 플랜은 원자적 조건부 증가로
    // 한도를 강제 — 동시 요청이 같은 스냅샷을 읽고 모두 통과하는 TOCTOU 오버슈트를 막는다.
    if (free) {
      const ok = await this.tenants.incrementUsageUnder(tenant.id, this.cfg.freePlanLimit)
      if (!ok) throw this.freePlanCapExceeded()
    } else {
      await this.tenants.incrementUsage(tenant.id)
    }

    // 서빙 성공 = 테넌트 지면의 실제 방문/트래픽 신호 → 오늘 일일 버킷에 멱등 누적(대시보드 "오늘 방문자").
    await this.recordVisit(tenant.id, now)

    return {
      served: true,
      creativeId: creative.id,
      imageUrl: creative.imageUrl,
      linkUrl: creative.linkUrl,
      alt: creative.alt,
      size: primarySize(sizes),
    }
  }

  /**
   * 오늘(서버 UTC 일자) 일일 방문 버킷을 1 증가시킨다(멱등 UPSERT). 서빙 성공 시에만 호출 —
   * 빈 응답(served:false)·봇 추적은 카운트하지 않는다. `(tenant_id, day)` PK 충돌 시 visits +1 누적이라
   * 동시 서빙도 안전하다(PostgreSQL·PGlite 동일).
   */
  private async recordVisit(tenantId: string, now: Date): Promise<void> {
    const day = utcDay(now)
    await this.dbs.db
      .insert(adVisits)
      .values({ tenantId, day, visits: 1 })
      .onConflictDoUpdate({
        target: [adVisits.tenantId, adVisits.day],
        set: { visits: sql`${adVisits.visits} + 1` },
      })
  }

  /** 무료 플랜 한도 초과 예외(402) — 1차/원자 증가 양쪽에서 동일 메시지로 던진다. */
  private freePlanCapExceeded(): HttpException {
    return new HttpException(
      `무료 플랜 서빙 한도(${this.cfg.freePlanLimit})를 초과했습니다. 플랜을 업그레이드하세요.`,
      HttpStatus.PAYMENT_REQUIRED
    )
  }

  /**
   * 노출 추적 — 크리에이티브의 impressions 를 1 증가.
   * 명백한 봇 User-Agent 면 카운터를 올리지 않고 영수증만 반환한다(IVT 1차 필터, 자기 CTR 부풀리기 방지).
   */
  async trackImpression(
    tenantId: string,
    creativeId: string,
    userAgent?: string | null
  ): Promise<TrackReceiptDto> {
    return this.trackEvent(tenantId, creativeId, 'impressions', userAgent)
  }

  /**
   * 클릭 추적 — 크리에이티브의 clicks 를 1 증가.
   * 명백한 봇 User-Agent 면 카운터를 올리지 않고 영수증만 반환한다(IVT 1차 필터).
   */
  async trackClick(
    tenantId: string,
    creativeId: string,
    userAgent?: string | null
  ): Promise<TrackReceiptDto> {
    return this.trackEvent(tenantId, creativeId, 'clicks', userAgent)
  }

  /**
   * 노출/클릭 공통 추적 — 봇 UA 면 증가를 건너뛰되 크리에이티브 존재는 여전히 검증(404)하고
   * 현재 카운터를 그대로 영수증으로 돌려준다(필터를 외부에 드러내지 않음). 사람 트래픽이면 증가.
   */
  private async trackEvent(
    tenantId: string,
    creativeId: string,
    column: 'impressions' | 'clicks',
    userAgent?: string | null
  ): Promise<TrackReceiptDto> {
    if (isBotUserAgent(userAgent)) {
      const row = await this.requireCreative(tenantId, creativeId)
      return { ok: true, count: column === 'impressions' ? row.impressions : row.clicks }
    }
    return this.bumpCounter(tenantId, creativeId, column)
  }

  /**
   * 어드민 통계 — 캠페인별 노출/클릭/CTR + 합계 + 트래픽/가입 집계.
   * 크리에이티브 카운터를 캠페인으로 집계하고 shared 의 computeStats 로 CTR/정렬을 계산한다.
   * totals 에는 대시보드 "트래픽 / 분석" 패널용 실DB 집계(오늘 방문/오늘 신규 가입/총 캠페인/총
   * 크리에이티브)를 함께 합친다.
   */
  async stats(tenantId: string, now: Date = new Date()): Promise<StatsDto> {
    const campaignRows = await this.dbs.db
      .select()
      .from(campaigns)
      .where(eq(campaigns.tenantId, tenantId))
    const nameById = new Map(campaignRows.map((c) => [c.id, c.name]))

    const agg = await this.dbs.db
      .select({
        campaignId: creatives.campaignId,
        impressions: sql<number>`coalesce(sum(${creatives.impressions}), 0)`,
        clicks: sql<number>`coalesce(sum(${creatives.clicks}), 0)`,
      })
      .from(creatives)
      .where(eq(creatives.tenantId, tenantId))
      .groupBy(creatives.campaignId)

    const rows = agg
      // 집계는 크리에이티브가 있는 캠페인만 — 이름을 가진 것만 남긴다(고아 방지).
      .filter((r) => nameById.has(r.campaignId))
      .map((r) => ({
        campaignId: r.campaignId,
        campaignName: nameById.get(r.campaignId) ?? '(이름 없음)',
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
      }))

    const traffic = await this.trafficTotals(tenantId, campaignRows.length, now)
    const result = computeStats(rows, traffic)
    return { campaigns: result.campaigns, totals: result.totals }
  }

  /**
   * 대시보드 "트래픽 / 분석" 패널용 실DB 집계(테넌트 스코프):
   * - todayVisits     — 오늘 일일 방문 버킷(ad_visits)의 visits(배포 이후 집계, 없으면 0).
   * - todayNewSignups — 오늘 생성된 캠페인 수 + 크리에이티브 수(createdAt ≥ 오늘 0시 UTC).
   * - totalCampaigns  — 누적 캠페인 수(이미 적재한 행 수 재사용 — 추가 쿼리 없음).
   * - totalCreatives  — 누적 크리에이티브 수(COUNT).
   * 전부 순수 COUNT/일일 버킷 — 새 추적 없이 정직하게 실측된다.
   */
  private async trafficTotals(
    tenantId: string,
    totalCampaigns: number,
    now: Date
  ): Promise<{
    todayVisits: number
    todayNewSignups: number
    totalCampaigns: number
    totalCreatives: number
  }> {
    const startOfDay = utcStartOfDay(now)

    const [visitsRow] = await this.dbs.db
      .select({ visits: adVisits.visits })
      .from(adVisits)
      .where(and(eq(adVisits.tenantId, tenantId), eq(adVisits.day, utcDay(now))))
      .limit(1)

    const [creativeAgg] = await this.dbs.db
      .select({
        total: sql<number>`count(*)`,
        today: sql<number>`coalesce(sum(case when ${creatives.createdAt} >= ${startOfDay} then 1 else 0 end), 0)`,
      })
      .from(creatives)
      .where(eq(creatives.tenantId, tenantId))

    const [campTodayRow] = await this.dbs.db
      .select({ today: sql<number>`count(*)` })
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), gte(campaigns.createdAt, startOfDay)))

    const totalCreatives = Number(creativeAgg?.total ?? 0)
    const todayCreatives = Number(creativeAgg?.today ?? 0)
    const todayCampaigns = Number(campTodayRow?.today ?? 0)

    return {
      todayVisits: Number(visitsRow?.visits ?? 0),
      todayNewSignups: todayCampaigns + todayCreatives,
      totalCampaigns,
      totalCreatives,
    }
  }

  /* ── 내부 헬퍼 ─────────────────────────────────────────────────────────── */

  /**
   * 슬롯에서 서빙 가능한(active 캠페인·기간 내) 크리에이티브 후보 + 슬롯의 권장 사이즈를 함께 모은다.
   * 서빙 응답의 size 힌트를 위한 별도 슬롯 조회를 없애 핫패스 라운드트립을 1회 줄인다(슬롯 1쿼리·후보 1쿼리).
   */
  private async servableCreatives(
    tenantId: string,
    slotKey: string,
    now: Date
  ): Promise<{ candidates: CreativeRow[]; sizes: string[] }> {
    const slotRows = await this.dbs.db
      .select({ sizes: slots.sizes })
      .from(slots)
      .where(and(eq(slots.tenantId, tenantId), eq(slots.key, slotKey)))
      .limit(1)

    const rows = await this.dbs.db
      .select({ creative: creatives, campaign: campaigns })
      .from(creatives)
      .innerJoin(campaigns, eq(creatives.campaignId, campaigns.id))
      .where(and(eq(creatives.tenantId, tenantId), eq(creatives.slotKey, slotKey)))

    const candidates = rows
      .filter((r) =>
        isCampaignServable(
          { status: r.campaign.status, startsAt: r.campaign.startsAt, endsAt: r.campaign.endsAt },
          now
        )
      )
      .map((r) => r.creative)

    return { candidates, sizes: slotRows[0]?.sizes ?? [] }
  }

  private async bumpCounter(
    tenantId: string,
    creativeId: string,
    column: 'impressions' | 'clicks'
  ): Promise<TrackReceiptDto> {
    const col = column === 'impressions' ? creatives.impressions : creatives.clicks
    const updated = await this.dbs.db
      .update(creatives)
      .set({ [column]: sql`${col} + 1` })
      .where(and(eq(creatives.tenantId, tenantId), eq(creatives.id, creativeId)))
      .returning({ impressions: creatives.impressions, clicks: creatives.clicks })
    const row = updated[0]
    if (!row) throw new NotFoundException(`크리에이티브 '${creativeId}' 가 없습니다`)
    return { ok: true, count: column === 'impressions' ? row.impressions : row.clicks }
  }

  private async requireCampaign(tenantId: string, id: string): Promise<CampaignRow> {
    const rows = await this.dbs.db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.tenantId, tenantId), eq(campaigns.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException(`캠페인 '${id}' 가 없습니다`)
    return rows[0]
  }

  private async requireCreative(tenantId: string, id: string): Promise<CreativeRow> {
    const rows = await this.dbs.db
      .select()
      .from(creatives)
      .where(and(eq(creatives.tenantId, tenantId), eq(creatives.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException(`크리에이티브 '${id}' 가 없습니다`)
    return rows[0]
  }

  private async requireSlot(tenantId: string, id: string): Promise<void> {
    const rows = await this.dbs.db
      .select({ id: slots.id })
      .from(slots)
      .where(and(eq(slots.tenantId, tenantId), eq(slots.id, id)))
      .limit(1)
    if (!rows[0]) throw new NotFoundException(`슬롯 '${id}' 가 없습니다`)
  }

  /**
   * 크리에이티브의 slotKey 가 실재하는 슬롯(테넌트 스코프)을 가리키는지 보장.
   * 없으면 400 — 유령 slotKey 는 어떤 servableCreatives 조인에도 안 걸려 영영 서빙되지 않으므로,
   * 저장 시점에 거절해 운영자가 즉시 알 수 있게 한다(silent never-serve 방지).
   */
  private async requireSlotKey(tenantId: string, slotKey: string): Promise<void> {
    const rows = await this.dbs.db
      .select({ id: slots.id })
      .from(slots)
      .where(and(eq(slots.tenantId, tenantId), eq(slots.key, slotKey)))
      .limit(1)
    if (!rows[0]) {
      throw new BadRequestException(
        `슬롯 key '${slotKey}' 가 없습니다. 먼저 슬롯을 만들거나 기존 슬롯 key 를 쓰세요.`
      )
    }
  }

  /* ── 이미지 업로드 ─────────────────────────────────────────────────────── */

  /**
   * 어드민 이미지 업로드 — base64/data: URL 을 디코딩·검증해 base64 텍스트로 저장한다.
   * 절대 URL 합성은 컨트롤러가 요청 호스트로 수행한다(서버리스/도메인 무관).
   */
  async createUpload(
    tenantId: string,
    input: UploadImageInput
  ): Promise<{ id: string; contentType: string; bytes: number }> {
    const { contentType: embeddedType, base64 } = parseImageData(input.data)
    // data: URL 에 형식이 박혀 있으면 선언 contentType 과 일치해야 한다(혼동/위장 방지).
    if (embeddedType && embeddedType !== input.contentType) {
      throw new BadRequestException('contentType 과 data URL 의 형식이 일치하지 않습니다')
    }
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(input.contentType)) {
      throw new BadRequestException('지원하지 않는 이미지 형식입니다')
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      throw new BadRequestException('이미지 데이터(base64)가 올바르지 않습니다')
    }
    const bytes = base64ByteLength(base64)
    if (bytes <= 0) throw new BadRequestException('이미지가 비어 있습니다')
    if (bytes > MAX_IMAGE_BYTES) {
      const mib = Math.floor(MAX_IMAGE_BYTES / 1024 / 1024)
      throw new BadRequestException(`이미지는 최대 ${mib} MiB 까지 업로드할 수 있습니다`)
    }

    const inserted = await this.dbs.db
      .insert(adUploads)
      .values({
        tenantId,
        contentType: input.contentType,
        data: base64,
        bytes,
        filename: input.filename ?? null,
      })
      .returning({ id: adUploads.id })
    return { id: inserted[0]!.id, contentType: input.contentType, bytes }
  }

  /**
   * 업로드 이미지 서빙용 조회(공개) — id 만으로 찾는다(불투명 UUID, 테넌트 스코프 없음).
   * 위젯/브라우저가 교차 출처로 <img> 로드하므로 키 검사 없이 바이트를 내려준다.
   */
  async getUpload(id: string): Promise<{ contentType: string; data: string } | null> {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null
    const rows = await this.dbs.db
      .select({ contentType: adUploads.contentType, data: adUploads.data })
      .from(adUploads)
      .where(eq(adUploads.id, id))
      .limit(1)
    return rows[0] ?? null
  }
}

/** 서버 일자(UTC)의 YYYY-MM-DD 문자열 — ad_visits.day(date) 버킷 키. */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/** 오늘 0시(UTC) Date — createdAt ≥ 오늘 필터 경계. */
function utcStartOfDay(now: Date): Date {
  return new Date(`${utcDay(now)}T00:00:00.000Z`)
}
