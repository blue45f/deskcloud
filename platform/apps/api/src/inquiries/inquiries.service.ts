import {
  INQUIRY_LIST_MAX_LIMIT,
  SLUG_RE,
  type InquiryAdminDto,
  type InquiryDto,
  type InquiryListDto,
  type InquiryListQuery,
  type InquiryStatus,
  type SubmitInquiryInput,
} from '@desk/shared'
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common'

import { INQUIRY_STORE, toCreateRecord, type InquiryStorePort } from './tokens'

const DEFAULT_LIMIT = 20

/** 제출 결과 — 허니팟에 걸리면 dropped=true(202 silently dropped), 그 외 생성된 문의. */
export interface SubmitResult {
  dropped: boolean
  inquiry?: InquiryDto
}

/** appId 정규화·검증 — slug 규약(소문자·숫자·하이픈, 1~64자)과 동일. */
function normalizeAppId(raw: string): string {
  const appId = raw.trim().toLowerCase()
  if (!appId || appId.length > 64 || !SLUG_RE.test(appId)) {
    throw new BadRequestException('appId는 소문자·숫자·하이픈(1~64자)이어야 합니다')
  }
  return appId
}

/** 어드민 DTO → 공개 DTO(회신 이메일·출처 URL redact). */
function toPublicDto(row: InquiryAdminDto): InquiryDto {
  return {
    id: row.id,
    appId: row.appId,
    category: row.category,
    status: row.status,
    title: row.title,
    body: row.body,
    authorName: row.authorName,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit == null) return DEFAULT_LIMIT
  return Math.min(Math.max(limit, 1), INQUIRY_LIST_MAX_LIMIT)
}

/**
 * 문의 서비스 — 공개 제출(허니팟 드롭) + 공개 게시판 목록(redact) + 어드민 트리아지.
 * 어떤 결제 자금 이동도 없고, 키 인증 없이 들어오는 공개 위젯 API 의 도메인 로직만 담는다.
 */
@Injectable()
export class InquiriesService {
  private readonly logger = new Logger('Inquiries')

  constructor(@Inject(INQUIRY_STORE) private readonly store: InquiryStorePort) {}

  /**
   * 문의 제출(공개). 허니팟(`website`)이 채워져 있으면 저장하지 않고 dropped 만 반환(봇 무력화).
   * 정상 입력은 저장 후 공개 DTO 로 반환(회신 이메일 등은 제외).
   */
  async submit(appIdRaw: string, input: SubmitInquiryInput): Promise<SubmitResult> {
    const appId = normalizeAppId(appIdRaw)
    // 허니팟: 사람은 보지 못하는 `website` 가 비어있지 않으면 봇 — 조용히 드롭(202).
    if (input.website && input.website.length > 0) {
      this.logger.warn(`허니팟 트립 — 문의 드롭 (app=${appId})`)
      return { dropped: true }
    }
    const created = await this.store.create(toCreateRecord(appId, input))
    this.logger.log(`문의 접수 (app=${appId}, category=${created.category}, id=${created.id})`)
    return { dropped: false, inquiry: toPublicDto(created) }
  }

  /** 공개 게시판 목록 — 앱별 최신순, 안전 필드만(회신 이메일·출처 URL redact). */
  async listPublic(appIdRaw: string, query: InquiryListQuery): Promise<InquiryListDto> {
    const appId = normalizeAppId(appIdRaw)
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0
    // 공개 목록은 상태 필터를 받지 않는다(전체 노출, 트리아지는 어드민 전용).
    const [rows, total] = await Promise.all([
      this.store.listByApp(appId, { limit, offset }),
      this.store.countByApp(appId),
    ])
    return { appId, items: rows.map(toPublicDto), limit, offset, total }
  }

  /** 어드민 목록 — 회신 이메일·출처 URL 포함. status/originHost 로 필터 가능. */
  async listAdmin(
    appIdRaw: string,
    query: InquiryListQuery
  ): Promise<InquiryListDto<InquiryAdminDto>> {
    const appId = normalizeAppId(appIdRaw)
    const limit = clampLimit(query.limit)
    const offset = query.offset ?? 0
    const [rows, total] = await Promise.all([
      this.store.listByApp(appId, {
        limit,
        offset,
        status: query.status,
        originHost: query.originHost,
      }),
      this.store.countByApp(appId, { status: query.status, originHost: query.originHost }),
    ])
    return { appId, items: rows, limit, offset, total }
  }

  /** 상태 변경(어드민 트리아지) — 해당 appId 의 문의만 갱신(경로 appId 와 불일치 시 404). */
  async setStatus(
    appIdRaw: string,
    id: string,
    status: InquiryStatus
  ): Promise<InquiryAdminDto | null> {
    const appId = normalizeAppId(appIdRaw)
    const existing = await this.store.getById(id)
    if (!existing || existing.appId !== appId) return null
    const updated = await this.store.updateStatus(id, status)
    if (updated) this.logger.log(`문의 상태 변경 (id=${id}) → ${status}`)
    return updated
  }
}
