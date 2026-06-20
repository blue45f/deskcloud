import { ALWAYS_ON_CHANNELS, type Channel } from './constants'

/** (type, channel) → enabled 조회용 맵 키. */
export const prefKey = (type: string, channel: Channel): string => `${type}::${channel}`

/** 선호 항목(맵 구성용). */
export interface PrefRecord {
  type: string
  channel: Channel
  enabled: boolean
}

/** 선호 레코드 배열을 빠른 조회 맵으로. */
export function buildPrefMap(prefs: PrefRecord[]): Map<string, boolean> {
  const map = new Map<string, boolean>()
  for (const p of prefs) map.set(prefKey(p.type, p.channel), p.enabled)
  return map
}

/** 선호 게이팅 결과 — 통과한 채널 + 억제된 채널. */
export interface ResolveChannelsResult {
  /** 실제로 발송할 채널(선호 통과). in_app 은 항상 포함. */
  allowed: Channel[]
  /** 선호 설정(enabled=false)으로 억제된 채널. */
  suppressed: Channel[]
}

/**
 * 요청 채널을 선호 설정 기준으로 게이팅한다(순수 함수).
 *
 * 규칙:
 * - `in_app`(ALWAYS_ON) 은 사용자가 끌 수 없다 — 요청에 있든 없든 무조건 통과.
 *   (인박스는 알림의 영구 기록이므로 항상 저장한다.)
 * - 그 외 채널은 (type, channel) 선호가 명시적으로 false 면 억제.
 *   선호 레코드가 없으면 기본 허용(opt-out 모델).
 * - 결과는 요청 채널의 순서를 보존하며 중복을 제거한다.
 *
 * api(발송 게이팅)·web(미리보기)·테스트 공유.
 */
export function resolveChannels(
  requested: Channel[],
  prefMap: Map<string, boolean>,
  type: string
): ResolveChannelsResult {
  const allowed: Channel[] = []
  const suppressed: Channel[] = []
  const seen = new Set<Channel>()

  // in_app 은 요청에 없어도 항상 포함(맨 앞).
  for (const ch of ALWAYS_ON_CHANNELS) {
    if (!seen.has(ch)) {
      allowed.push(ch)
      seen.add(ch)
    }
  }

  for (const ch of requested) {
    if (seen.has(ch)) continue
    seen.add(ch)
    if (ALWAYS_ON_CHANNELS.includes(ch)) {
      allowed.push(ch)
      continue
    }
    const enabled = prefMap.get(prefKey(type, ch))
    if (enabled === false) {
      suppressed.push(ch)
    } else {
      allowed.push(ch)
    }
  }

  return { allowed, suppressed }
}
