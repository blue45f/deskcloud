import { z } from 'zod'

/**
 * 중앙 문의(Inquiry) — 형제 사이트·조직 공개 페이지에서 들어오는 비공개 접수.
 * 공개 게시판(support_posts)과 달리 본문·연락처가 외부에 노출되지 않으며,
 * 운영자 대시보드(/app/inquiries)에서만 열람·처리합니다.
 */

export const inquiryCategories = ['contact', 'partnership', 'bug', 'qa', 'question'] as const
export type InquiryCategory = (typeof inquiryCategories)[number]

export const inquiryStatuses = ['new', 'in_progress', 'closed'] as const
export type InquiryStatus = (typeof inquiryStatuses)[number]

const trimmedText = (min: number, max: number) => z.string().trim().min(min).max(max)

export const createInquirySchema = z.object({
  category: z.enum(inquiryCategories),
  title: trimmedText(2, 140),
  body: trimmedText(10, 4000),
  /** 회신 받을 이메일(선택). 빈 문자열은 미입력으로 취급(''→undefined) — 폼 기본값 호환. */
  contactEmail: z
    .union([z.email().max(200), z.literal(''), z.null()])
    .transform((v) => (v ? v : undefined))
    .optional(),
  /** 문의가 발생한 페이지 URL(선택) — 없으면 서버가 Origin 헤더로 보완.
   * 어드민 보드에서 href 로 렌더되므로 http(s) 외 스킴(javascript: 등)은 접수 단계에서 거부. */
  originUrl: z
    .union([z.string().trim().max(500), z.null()])
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || /^https?:\/\//i.test(v), {
      message: '접수 페이지 주소는 http(s) URL만 허용됩니다',
    })
    .optional(),
  /** 허니팟 — 사람에게는 보이지 않는 숨김 필드. 채워져 있으면 서버가 조용히 폐기. */
  website: z
    .union([z.string().max(200), z.null()])
    .transform((v) => v ?? undefined)
    .optional(),
})
export type CreateInquiryInput = z.infer<typeof createInquirySchema>

export const updateInquirySchema = z
  .object({
    status: z.enum(inquiryStatuses).optional(),
    /** null → 메모 제거, 미전달(undefined) → 변경 없음. */
    adminNote: z.string().trim().max(2000).nullable().optional(),
  })
  .refine((v) => v.status !== undefined || v.adminNote !== undefined, {
    message: '변경할 항목이 없습니다',
  })
export type UpdateInquiryInput = z.infer<typeof updateInquirySchema>

/** 운영자 보드 전용 — 연락처·IP 등 비공개 메타를 포함하므로 공개 응답에 쓰지 않습니다. */
export interface InquiryDto {
  id: string
  /** 출처 사이트 식별(1차 축) — 정적 포트폴리오 사이트는 DB 조직 없이 slug 로만 존재. */
  siteSlug: string
  /** DB 조직(organizations) 매치 시에만 연결. 정적 카탈로그 사이트는 null. */
  orgId: string | null
  category: InquiryCategory
  status: InquiryStatus
  title: string
  body: string
  contactEmail: string | null
  originUrl: string | null
  userAgent: string | null
  ip: string | null
  adminNote: string | null
  createdAt: string
  updatedAt: string
}

/** 공개 제출자에게 돌려주는 최소 영수증 — 본문·연락처는 절대 되돌려주지 않습니다. */
export interface InquiryReceiptDto {
  id: string
  siteSlug: string
  category: InquiryCategory
  status: InquiryStatus
  createdAt: string
}

export interface InquiryListDto {
  items: InquiryDto[]
  /** 같은 필터의 전체 건수(페이지네이션용 — X-Total-Count 헤더와 동일 값). */
  total: number
}
