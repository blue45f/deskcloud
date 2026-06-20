import { describe, expect, it } from 'vitest'

import { computeStats, ctr, isCampaignServable, pickWeighted, primarySize } from './serve'

describe('pickWeighted', () => {
  it('빈 후보면 null', () => {
    expect(pickWeighted([])).toBeNull()
  })

  it('후보 1개면 항상 그 후보', () => {
    const only = { id: 'a', weight: 1 }
    expect(pickWeighted([only], () => 0)).toBe(only)
    expect(pickWeighted([only], () => 0.999)).toBe(only)
  })

  it('주입한 난수에 따라 가중 구간을 결정적으로 고른다', () => {
    // weights [1, 3] → total 4. 구간 a:[0,1), b:[1,4).
    const cs = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 3 },
    ]
    expect(pickWeighted(cs, () => 0.1)?.id).toBe('a') // 0.4 < 1 → a
    expect(pickWeighted(cs, () => 0.2)?.id).toBe('a') // 0.8 < 1 → a
    expect(pickWeighted(cs, () => 0.3)?.id).toBe('b') // 1.2 ≥ 1 → b
    expect(pickWeighted(cs, () => 0.9)?.id).toBe('b') // 3.6 → b
  })

  it('가중 분포가 대략 비율을 따른다(시드 RNG)', () => {
    const cs = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 9 },
    ]
    // 순환 의사난수(0..1) — 결정적.
    let seed = 0.123456789
    const rng = () => {
      seed = (seed * 9301 + 49297) % 233280
      return seed / 233280
    }
    const counts: Record<string, number> = { a: 0, b: 0 }
    for (let i = 0; i < 10_000; i += 1) {
      const pick = pickWeighted(cs, rng)
      if (pick) counts[pick.id] = (counts[pick.id] ?? 0) + 1
    }
    // b 는 weight 9/10 이라 a 보다 압도적으로 많이 뽑혀야 한다.
    expect(counts.b).toBeGreaterThan(counts.a! * 5)
    // a 도 0 은 아니다(0 확률 방지).
    expect(counts.a).toBeGreaterThan(0)
  })

  it('비정상 weight(<1·비정수·NaN)는 1로 보정해 선택 가능성을 보장', () => {
    const cs = [
      { id: 'a', weight: 0 },
      { id: 'b', weight: Number.NaN },
      { id: 'c', weight: -5 },
    ]
    // 전부 1로 보정 → total 3. 첫 칸 a.
    expect(pickWeighted(cs, () => 0)?.id).toBe('a')
    // 끝 근처 → c.
    expect(pickWeighted(cs, () => 0.99)?.id).toBe('c')
  })

  it('rng 이 범위를 벗어나도(>=1, 음수) throw 하지 않고 안전 선택', () => {
    const cs = [
      { id: 'a', weight: 1 },
      { id: 'b', weight: 1 },
    ]
    expect(pickWeighted(cs, () => 1.5)).not.toBeNull()
    expect(pickWeighted(cs, () => -1)?.id).toBe('a')
  })
})

describe('primarySize', () => {
  it('첫 사이즈를 권장 힌트로 고른다', () => {
    expect(primarySize(['300x250', '728x90'])).toBe('300x250')
  })

  it('빈 목록·null·undefined 면 null', () => {
    expect(primarySize([])).toBeNull()
    expect(primarySize(null)).toBeNull()
    expect(primarySize(undefined)).toBeNull()
  })
})

describe('isCampaignServable', () => {
  const now = new Date('2026-06-15T12:00:00.000Z')

  it('paused 면 서빙 안 함', () => {
    expect(isCampaignServable({ status: 'paused', startsAt: null, endsAt: null }, now)).toBe(false)
  })

  it('active + 기간 무제한이면 서빙', () => {
    expect(isCampaignServable({ status: 'active', startsAt: null, endsAt: null }, now)).toBe(true)
  })

  it('시작 전이면 서빙 안 함', () => {
    expect(
      isCampaignServable(
        { status: 'active', startsAt: '2026-06-20T00:00:00.000Z', endsAt: null },
        now
      )
    ).toBe(false)
  })

  it('종료 후면 서빙 안 함', () => {
    expect(
      isCampaignServable(
        { status: 'active', startsAt: null, endsAt: '2026-06-10T00:00:00.000Z' },
        now
      )
    ).toBe(false)
  })

  it('기간 내면 서빙', () => {
    expect(
      isCampaignServable(
        {
          status: 'active',
          startsAt: '2026-06-01T00:00:00.000Z',
          endsAt: '2026-06-30T00:00:00.000Z',
        },
        now
      )
    ).toBe(true)
  })
})

describe('ctr', () => {
  it('노출 0이면 0', () => {
    expect(ctr(0, 0)).toBe(0)
    expect(ctr(0, 5)).toBe(0)
  })

  it('clicks/impressions*100, 소수 둘째 자리', () => {
    expect(ctr(1000, 25)).toBe(2.5)
    expect(ctr(3, 1)).toBe(33.33)
  })
})

describe('computeStats', () => {
  it('빈 입력이면 0 합계(트래픽 필드 포함)', () => {
    const s = computeStats([])
    expect(s.campaigns).toEqual([])
    expect(s.totals).toEqual({
      impressions: 0,
      clicks: 0,
      ctr: 0,
      todayVisits: 0,
      todayNewSignups: 0,
      totalCampaigns: 0,
      totalCreatives: 0,
    })
  })

  it('트래픽/가입 집계를 합계에 합치고 음수는 보정', () => {
    const s = computeStats([], {
      todayVisits: 7,
      todayNewSignups: 2,
      totalCampaigns: 5,
      totalCreatives: -1,
    })
    expect(s.totals.todayVisits).toBe(7)
    expect(s.totals.todayNewSignups).toBe(2)
    expect(s.totals.totalCampaigns).toBe(5)
    expect(s.totals.totalCreatives).toBe(0) // 음수 보정
  })

  it('캠페인별 CTR 계산 + 노출 내림차순 정렬 + 합계', () => {
    const s = computeStats([
      { campaignId: 'c1', campaignName: 'A', impressions: 100, clicks: 10 },
      { campaignId: 'c2', campaignName: 'B', impressions: 400, clicks: 8 },
    ])
    // 정렬: 노출 많은 B 먼저
    expect(s.campaigns[0]?.campaignId).toBe('c2')
    expect(s.campaigns[0]?.ctr).toBe(2) // 8/400
    expect(s.campaigns[1]?.ctr).toBe(10) // 10/100
    expect(s.totals.impressions).toBe(500)
    expect(s.totals.clicks).toBe(18)
    expect(s.totals.ctr).toBe(3.6) // 18/500
  })

  it('음수·소수 카운트는 0 이상 정수로 보정', () => {
    const s = computeStats([{ campaignId: 'c', campaignName: 'X', impressions: -3, clicks: 2.9 }])
    expect(s.campaigns[0]?.impressions).toBe(0)
    expect(s.campaigns[0]?.clicks).toBe(2)
  })
})
