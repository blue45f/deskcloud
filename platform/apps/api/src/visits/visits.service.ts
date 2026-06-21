import { SLUG_RE, type VisitPingInput, type VisitStatsDto } from '@desk/shared'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'

import { VISITS_STORE, type VisitsStorePort } from './tokens'

/** appId 정규화·검증 — slug 규약(소문자·숫자·하이픈, 1~64자)과 동일(문의 모듈 미러). */
function normalizeAppId(raw: string): string {
  const appId = raw.trim().toLowerCase()
  if (!appId || appId.length > 64 || !SLUG_RE.test(appId)) {
    throw new BadRequestException('appId는 소문자·숫자·하이픈(1~64자)이어야 합니다')
  }
  return appId
}

/** 오늘 일자 키('YYYY-MM-DD', UTC). 버킷 키와 stats 의 day 필드에 동일하게 쓴다. */
function todayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

/**
 * 방문/트래픽 서비스 — 공개 핑(원자적 일별 증가) + 공개 집계(오늘/전체).
 * 결제·자금 이동 없음. 키 인증 없이 들어오는 공개 위젯 API 의 도메인 로직만 담는다.
 * 클라이언트가 일별·세션별 디바운스를 책임지고(브라우저당 1일 1회), 서버는 IP 스로틀로 폭주만 막는다.
 */
@Injectable()
export class VisitsService {
  private readonly logger = new Logger('Visits')

  constructor(@Inject(VISITS_STORE) private readonly store: VisitsStorePort) {}

  /** 방문 핑(공개). 오늘 버킷을 원자적으로 +1(고유 방문자면 uniques 도 +1). */
  async ping(appIdRaw: string, input: VisitPingInput): Promise<void> {
    const appId = normalizeAppId(appIdRaw)
    const day = todayKey()
    await this.store.ping({ appId, day, newVisitor: input?.newVisitor === true })
  }

  /** 방문 집계(공개) — 오늘(day 일치) + 전체(SUM) 방문/고유 방문자. 데이터 없으면 0. */
  async stats(appIdRaw: string): Promise<VisitStatsDto> {
    const appId = normalizeAppId(appIdRaw)
    const day = todayKey()
    return this.store.stats(appId, day)
  }
}
