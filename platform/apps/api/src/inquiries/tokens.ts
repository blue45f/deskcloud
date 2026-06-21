import type {
  InquiryAdminDto,
  InquiryCategory,
  InquiryStatus,
  SubmitInquiryInput,
} from '@desk/shared'

/** 문의 스토어 DI 토큰. */
export const INQUIRY_STORE = Symbol('INQUIRY_STORE')

/** 새 문의 영속화 입력 — appId + 검증 통과한 입력(허니팟 제외). */
export interface CreateInquiryRecord {
  appId: string
  category: InquiryCategory
  title: string
  body: string
  contactEmail: string | null
  originUrl: string | null
  originHost: string | null
  authorName: string | null
}

/** 목록 조회 옵션 — 앱별 최신순 페이지네이션(+ 어드민용 상태/서비스 도메인 필터). */
export interface ListInquiriesOptions {
  limit: number
  offset: number
  status?: InquiryStatus
  originHost?: string
}

/**
 * 문의 영속화 포트 — apps/api 가 Drizzle 로 구현해 주입한다(테스트는 인메모리/PGlite).
 * 항상 contactEmail·originUrl 을 포함한 어드민 표현({@link InquiryAdminDto})으로 반환하고,
 * 공개 redact 는 서비스 경계에서 수행한다.
 */
export interface InquiryStorePort {
  create(rec: CreateInquiryRecord): Promise<InquiryAdminDto>
  listByApp(appId: string, opts: ListInquiriesOptions): Promise<InquiryAdminDto[]>
  getById(id: string): Promise<InquiryAdminDto | null>
  updateStatus(id: string, status: InquiryStatus): Promise<InquiryAdminDto | null>
}

/** 출처 URL → host[:port]. 잘못된 URL은 저장하지 않고 URL 원문만 보존한다. */
export function originHostFromUrl(originUrl: string | null | undefined): string | null {
  if (!originUrl) return null
  try {
    return new URL(originUrl).host.toLowerCase()
  } catch {
    return null
  }
}

/** 허니팟을 제거한 검증 입력 → 저장 레코드. */
export function toCreateRecord(appId: string, input: SubmitInquiryInput): CreateInquiryRecord {
  const originUrl = input.originUrl ?? null
  return {
    appId,
    category: input.category,
    title: input.title,
    body: input.body,
    contactEmail: input.contactEmail ?? null,
    originUrl,
    originHost: originHostFromUrl(originUrl),
    authorName: input.authorName ?? null,
  }
}
