import { WEIGHT_MIN } from './constants'

/** 가중 선택 후보 — 크리에이티브 1건에서 선택에 필요한 최소 정보. */
export interface WeightedCreative {
  id: string
  weight: number
}

/**
 * 가중 랜덤 선택(순수 함수) — 후보 중 weight 에 비례한 확률로 하나를 고른다.
 *
 * - 후보가 없으면 null.
 * - weight 가 비정상(<1·비정수·NaN)이면 WEIGHT_MIN(=1)로 보정해 항상 선택 가능성을 가진다
 *   (활성 크리에이티브가 0 확률로 영원히 안 뽑히는 일을 막는다).
 * - rng 는 [0,1) 난수 공급자(기본 Math.random) — 테스트에서 주입해 결정적으로 검증한다.
 *
 * api(공개 서빙)·테스트가 공유한다.
 */
export function pickWeighted<T extends WeightedCreative>(
  candidates: readonly T[],
  rng: () => number = Math.random
): T | null {
  if (candidates.length === 0) return null

  const weights = candidates.map((c) => normalizeWeight(c.weight))
  const total = weights.reduce((a, w) => a + w, 0)
  if (total <= 0) return candidates[0] ?? null

  // [0, total) 구간을 누적 가중으로 분할해 난수가 떨어지는 칸을 고른다.
  let threshold = clampUnit(rng()) * total
  for (let i = 0; i < candidates.length; i += 1) {
    threshold -= weights[i] ?? 0
    if (threshold < 0) return candidates[i] ?? null
  }
  // 부동소수 누적 오차로 끝까지 못 떨어졌으면 마지막 후보.
  return candidates[candidates.length - 1] ?? null
}

/** weight 를 정수 ≥ WEIGHT_MIN 으로 보정. */
function normalizeWeight(weight: number): number {
  if (!Number.isFinite(weight)) return WEIGHT_MIN
  const floored = Math.floor(weight)
  return floored < WEIGHT_MIN ? WEIGHT_MIN : floored
}

/** 난수를 [0,1) 로 클램프(주입 rng 방어). */
function clampUnit(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  if (n >= 1) return 0.999999999
  return n
}

/**
 * 슬롯이 받는 사이즈 중 서빙 응답의 권장 size 힌트를 고른다(순수 함수).
 * 현재는 슬롯의 첫 사이즈(레이아웃 안정화 힌트). 사이즈가 없으면 null.
 * api(서빙 핫패스)·테스트가 공유한다 — 서빙 시 추가 DB 조회 없이 이미 적재한 슬롯 행에서 파생.
 */
export function primarySize(sizes: readonly string[] | null | undefined): string | null {
  return sizes?.[0] ?? null
}

/** 캠페인 기간/상태가 지금 서빙 대상인지(순수 함수). */
export function isCampaignServable(
  campaign: { status: string; startsAt: Date | string | null; endsAt: Date | string | null },
  now: Date = new Date()
): boolean {
  if (campaign.status !== 'active') return false
  const t = now.getTime()
  if (campaign.startsAt != null) {
    const start = new Date(campaign.startsAt).getTime()
    if (Number.isFinite(start) && t < start) return false
  }
  if (campaign.endsAt != null) {
    const end = new Date(campaign.endsAt).getTime()
    if (Number.isFinite(end) && t > end) return false
  }
  return true
}

/* ── 통계(CTR) ──────────────────────────────────────────────────────────────── */

/** 집계 입력 — 캠페인 1건의 노출/클릭 카운트. */
export interface StatInputRow {
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
}

/** 캠페인별 통계 1건(CTR 포함). */
export interface CampaignStat {
  campaignId: string
  campaignName: string
  impressions: number
  clicks: number
  /** 클릭/노출 비율(%), 소수 둘째 자리. 노출 0이면 0. */
  ctr: number
}

/**
 * 전체 합계 + CTR + 트래픽/가입 집계.
 *
 * impressions/clicks/ctr 는 크리에이티브 카운터에서 파생한 누적 성과다. 아래 트래픽/분석 필드는
 * 대시보드의 "트래픽 / 분석" 패널을 위해 가산적으로 추가됐다(public 계약은 진화적으로만):
 * - todayVisits     — 오늘(서버 일자) 이 테넌트 슬롯에 서빙된 광고 노출 수(= 방문/트래픽 신호).
 *                     `ad_visits` 일일 버킷에서 읽는 **배포 이후 집계**값(백필 없음).
 * - todayNewSignups — 오늘 이 테넌트가 등록한 광고 엔티티(캠페인+크리에이티브) 수.
 * - totalCampaigns  — 이 테넌트의 누적 캠페인 수.
 * - totalCreatives  — 이 테넌트의 누적 크리에이티브 수.
 */
export interface StatsTotals {
  impressions: number
  clicks: number
  ctr: number
  /** 오늘 서빙된 노출 수(트래픽 신호) — ad_visits 일일 버킷, 배포 이후 집계. */
  todayVisits: number
  /** 오늘 등록된 광고 엔티티(캠페인+크리에이티브) 수. */
  todayNewSignups: number
  /** 누적 캠페인 수. */
  totalCampaigns: number
  /** 누적 크리에이티브 수. */
  totalCreatives: number
}

/** computeStats 에 합칠 트래픽/가입 집계(실DB COUNT/일일 버킷에서 주입). 미지정 시 0. */
export interface TrafficTotals {
  todayVisits?: number
  todayNewSignups?: number
  totalCampaigns?: number
  totalCreatives?: number
}

/** 통계 응답(캠페인별 + 합계). */
export interface StatsResult {
  campaigns: CampaignStat[]
  totals: StatsTotals
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** CTR(%) = clicks / impressions * 100. 노출 0이면 0. */
export function ctr(impressions: number, clicks: number): number {
  if (!impressions || impressions <= 0) return 0
  return round2((clicks / impressions) * 100)
}

/** 음수·비정수 트래픽 카운트를 0 이상 정수로 보정. */
function safeCount(n: number | undefined): number {
  return Math.max(0, Math.trunc(n ?? 0))
}

/**
 * 캠페인별 노출/클릭 행으로 CTR·합계를 계산(순수 함수).
 * api(어드민 통계)·테스트가 공유한다. 입력은 노출 내림차순으로 정렬해 반환.
 *
 * `traffic` 는 별도의 실DB COUNT/일일 버킷에서 온 트래픽/가입 집계를 합계에 합친다(가산적). 미지정 시
 * 0 으로 채워 totals 형태는 항상 일정하게 유지한다 — 대시보드 "트래픽 / 분석" 카드가 안전하게 읽는다.
 */
export function computeStats(
  rows: readonly StatInputRow[],
  traffic: TrafficTotals = {}
): StatsResult {
  const campaigns: CampaignStat[] = rows
    .map((r) => {
      const impressions = Math.max(0, Math.trunc(r.impressions || 0))
      const clicks = Math.max(0, Math.trunc(r.clicks || 0))
      return {
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        impressions,
        clicks,
        ctr: ctr(impressions, clicks),
      }
    })
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)

  const impressions = campaigns.reduce((a, c) => a + c.impressions, 0)
  const clicks = campaigns.reduce((a, c) => a + c.clicks, 0)

  return {
    campaigns,
    totals: {
      impressions,
      clicks,
      ctr: ctr(impressions, clicks),
      todayVisits: safeCount(traffic.todayVisits),
      todayNewSignups: safeCount(traffic.todayNewSignups),
      totalCampaigns: safeCount(traffic.totalCampaigns),
      totalCreatives: safeCount(traffic.totalCreatives),
    },
  }
}
