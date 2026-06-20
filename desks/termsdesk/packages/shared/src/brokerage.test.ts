import { describe, expect, it } from 'vitest'

import {
  adminUpdateProviderSchema,
  adminUpdateRequestSchema,
  createMessageSchema,
  createProposalSchema,
  createServiceRequestSchema,
  flagRequestSchema,
  formatBudgetRange,
  formatKrw,
  requestRevisionSchema,
  upsertProviderProfileSchema,
} from './brokerage'

const validRequest = {
  title: '이용약관 개정 검토',
  description: '신규 결제 모듈 도입에 따른 이용약관·환불정책 개정 검토를 의뢰합니다.',
  serviceType: 'review',
  policyType: 'terms',
} as const

describe('createServiceRequestSchema', () => {
  it('정상 입력을 트림·기본값과 함께 파싱한다', () => {
    const parsed = createServiceRequestSchema.parse({
      ...validRequest,
      title: '  이용약관 개정 검토  ',
    })
    expect(parsed.title).toBe('이용약관 개정 검토')
    expect(parsed.serviceType).toBe('review')
    expect(parsed.policyType).toBe('terms')
    // 기본값
    expect(parsed.jurisdiction).toBe('KR')
    expect(parsed.visibility).toBe('public')
  })

  it('빈 문자열/null 예산·마감일을 미입력(undefined)으로 접는다', () => {
    const parsed = createServiceRequestSchema.parse({
      ...validRequest,
      budgetMin: '',
      budgetMax: null,
      deadline: '',
    })
    expect(parsed.budgetMin).toBeUndefined()
    expect(parsed.budgetMax).toBeUndefined()
    expect(parsed.deadline).toBeUndefined()
  })

  it('NaN 예산(빈 number 입력 valueAsNumber)을 미입력으로 접는다', () => {
    // react-hook-form 의 valueAsNumber 는 빈 숫자 입력을 NaN 으로 만든다 — 검증을 통과해야 한다.
    const parsed = createServiceRequestSchema.parse({
      ...validRequest,
      budgetMin: Number.NaN,
      budgetMax: Number.NaN,
    })
    expect(parsed.budgetMin).toBeUndefined()
    expect(parsed.budgetMax).toBeUndefined()
  })

  it('정상 예산·마감일을 보존한다', () => {
    const parsed = createServiceRequestSchema.parse({
      ...validRequest,
      budgetMin: 1_000_000,
      budgetMax: 3_000_000,
      deadline: '2026-09-30',
    })
    expect(parsed.budgetMin).toBe(1_000_000)
    expect(parsed.budgetMax).toBe(3_000_000)
    expect(parsed.deadline).toBe('2026-09-30')
  })

  it('예산 역전(min > max)을 거부한다 — 같거나 한쪽만 있으면 허용', () => {
    expect(
      createServiceRequestSchema.safeParse({
        ...validRequest,
        budgetMin: 5_000_000,
        budgetMax: 1_000_000,
      }).success
    ).toBe(false)
    expect(
      createServiceRequestSchema.safeParse({
        ...validRequest,
        budgetMin: 2_000_000,
        budgetMax: 2_000_000,
      }).success
    ).toBe(true)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, budgetMin: 5_000_000 }).success
    ).toBe(true)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, budgetMax: 1_000_000 }).success
    ).toBe(true)
  })

  it('잘못된 마감일 형식을 거부한다', () => {
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, deadline: '2026/09/30' }).success
    ).toBe(false)
  })

  it('제목 4..140 · 설명 20..6000 길이 경계를 지킨다', () => {
    expect(createServiceRequestSchema.safeParse({ ...validRequest, title: '가나다' }).success).toBe(
      false
    )
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, title: '가나다라' }).success
    ).toBe(true)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, title: '가'.repeat(140) }).success
    ).toBe(true)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, title: '가'.repeat(141) }).success
    ).toBe(false)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, description: '가'.repeat(19) })
        .success
    ).toBe(false)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, description: '가'.repeat(20) })
        .success
    ).toBe(true)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, description: '가'.repeat(6001) })
        .success
    ).toBe(false)
  })

  it('어휘를 벗어난 serviceType/policyType 을 거부한다', () => {
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, serviceType: 'audit' }).success
    ).toBe(false)
    expect(
      createServiceRequestSchema.safeParse({ ...validRequest, policyType: 'unknown' }).success
    ).toBe(false)
  })
})

describe('createProposalSchema', () => {
  const validProposal = {
    message: '약관 검토 경험이 많습니다. 2주 내 의견서와 개정안 초안을 드리겠습니다.',
  } as const

  it('정상 제안을 트림하고 선택값을 보존한다', () => {
    const parsed = createProposalSchema.parse({
      message: `  ${validProposal.message}  `,
      quotedAmount: 2_000_000,
      estimatedDays: 14,
    })
    expect(parsed.message).toBe(validProposal.message)
    expect(parsed.quotedAmount).toBe(2_000_000)
    expect(parsed.estimatedDays).toBe(14)
  })

  it('빈 문자열/null 견적·예상일을 미입력으로 접는다', () => {
    const parsed = createProposalSchema.parse({
      ...validProposal,
      quotedAmount: '',
      estimatedDays: null,
    })
    expect(parsed.quotedAmount).toBeUndefined()
    expect(parsed.estimatedDays).toBeUndefined()
  })

  it('메시지 20..4000 경계와 예상일 1..3650 범위를 지킨다', () => {
    expect(createProposalSchema.safeParse({ message: '가'.repeat(19) }).success).toBe(false)
    expect(createProposalSchema.safeParse({ message: '가'.repeat(20) }).success).toBe(true)
    expect(createProposalSchema.safeParse({ message: '가'.repeat(4001) }).success).toBe(false)
    expect(createProposalSchema.safeParse({ ...validProposal, estimatedDays: 0 }).success).toBe(
      false
    )
    expect(createProposalSchema.safeParse({ ...validProposal, estimatedDays: 3651 }).success).toBe(
      false
    )
  })
})

describe('createMessageSchema', () => {
  it('본문을 트림하고 기본 kind 를 message 로 둔다', () => {
    const parsed = createMessageSchema.parse({ body: '  초안 확인 부탁드립니다.  ' })
    expect(parsed.body).toBe('초안 확인 부탁드립니다.')
    expect(parsed.kind).toBe('message')
    expect(parsed.attachmentIds).toEqual([])
  })

  it('delivery kind 를 허용하고 빈 본문·system kind 는 거부한다', () => {
    expect(
      createMessageSchema.safeParse({ body: '산출물 제출합니다.', kind: 'delivery' }).success
    ).toBe(true)
    expect(createMessageSchema.safeParse({ body: '' }).success).toBe(false)
    expect(createMessageSchema.safeParse({ body: '시스템', kind: 'system' }).success).toBe(false)
  })

  it('첨부 id 는 최대 5개까지 허용한다', () => {
    const ids = Array.from({ length: 5 }, (_, i) => `11111111-1111-4111-8111-11111111111${i}`)
    const parsed = createMessageSchema.parse({
      body: '첨부 확인 부탁드립니다.',
      attachmentIds: ids,
    })
    expect(parsed.attachmentIds).toHaveLength(5)
    expect(
      createMessageSchema.safeParse({
        body: '첨부가 너무 많습니다.',
        attachmentIds: [...ids, '11111111-1111-4111-8111-111111111115'],
      }).success
    ).toBe(false)
  })
})

describe('flagRequestSchema', () => {
  it('신고 사유를 트림하고 메시지 id 를 허용한다', () => {
    const parsed = flagRequestSchema.parse({
      note: '  산출물 범위가 합의와 다릅니다.  ',
      messageId: '11111111-1111-4111-8111-111111111111',
    })
    expect(parsed.note).toBe('산출물 범위가 합의와 다릅니다.')
    expect(parsed.messageId).toBe('11111111-1111-4111-8111-111111111111')
  })

  it('짧은 사유와 잘못된 메시지 id 를 거부한다', () => {
    expect(flagRequestSchema.safeParse({ note: '짧음' }).success).toBe(false)
    expect(
      flagRequestSchema.safeParse({ note: '충분한 사유입니다.', messageId: 'nope' }).success
    ).toBe(false)
  })
})

describe('requestRevisionSchema', () => {
  it('재작업 요청 사유를 트림하고 5자 미만은 거부한다', () => {
    expect(requestRevisionSchema.parse({ note: '  조항별 근거를 보강해 주세요.  ' }).note).toBe(
      '조항별 근거를 보강해 주세요.'
    )
    expect(requestRevisionSchema.safeParse({ note: '부족' }).success).toBe(false)
  })
})

describe('upsertProviderProfileSchema', () => {
  const validProfile = {
    displayName: '김변호사',
    headline: '개인정보·약관 전문',
    bio: '10년간 스타트업 약관·개인정보처리방침 작성 및 검토를 담당했습니다.',
  } as const

  it('미입력 specialties 를 빈 배열로 변환하고 기본값을 채운다', () => {
    const parsed = upsertProviderProfileSchema.parse(validProfile)
    expect(parsed.specialties).toEqual([])
    expect(parsed.jurisdictions).toBe('KR')
    expect(parsed.active).toBe(true)
    expect(parsed.contact).toBeUndefined()
  })

  it('specialties 각 태그를 트림하며 정상값을 보존한다', () => {
    const parsed = upsertProviderProfileSchema.parse({
      ...validProfile,
      specialties: ['  개인정보  ', '환불정책'],
      contact: '  hello@law.example  ',
    })
    expect(parsed.specialties).toEqual(['개인정보', '환불정책'])
    expect(parsed.contact).toBe('hello@law.example')
  })

  it('specialties 최대 10개·각 1..40자 경계를 지킨다', () => {
    expect(
      upsertProviderProfileSchema.safeParse({
        ...validProfile,
        specialties: Array(11).fill('태그'),
      }).success
    ).toBe(false)
    expect(
      upsertProviderProfileSchema.safeParse({ ...validProfile, specialties: ['가'.repeat(41)] })
        .success
    ).toBe(false)
  })

  it('빈 문자열 contact 를 미입력으로 접는다', () => {
    const parsed = upsertProviderProfileSchema.parse({ ...validProfile, contact: '' })
    expect(parsed.contact).toBeUndefined()
  })
})

describe('adminUpdateRequestSchema', () => {
  it('빈 변경(아무 필드 없음)을 거부한다', () => {
    expect(adminUpdateRequestSchema.safeParse({}).success).toBe(false)
  })

  it('status 또는 adminNote 중 하나면 통과한다 (adminNote=null 은 메모 제거)', () => {
    expect(adminUpdateRequestSchema.safeParse({ status: 'cancelled' }).success).toBe(true)
    expect(adminUpdateRequestSchema.safeParse({ adminNote: null }).success).toBe(true)
    const parsed = adminUpdateRequestSchema.parse({ adminNote: ' 운영 메모 ' })
    expect(parsed.adminNote).toBe('운영 메모')
  })

  it('cancelled 외 status 를 거부한다', () => {
    expect(adminUpdateRequestSchema.safeParse({ status: 'completed' }).success).toBe(false)
  })

  it('분쟁 표시·분쟁 메모·운영자 에스크로 결정을 허용한다', () => {
    expect(adminUpdateRequestSchema.safeParse({ flagged: true }).success).toBe(true)
    const parsed = adminUpdateRequestSchema.parse({
      flagged: false,
      disputeNote: '  운영자 검토 완료  ',
      escrowDecision: 'refund',
    })
    expect(parsed.disputeNote).toBe('운영자 검토 완료')
    expect(parsed.escrowDecision).toBe('refund')
    expect(adminUpdateRequestSchema.safeParse({ escrowDecision: 'hold' }).success).toBe(false)
  })
})

describe('adminUpdateProviderSchema', () => {
  it('빈 변경(아무 필드 없음)을 거부한다', () => {
    expect(adminUpdateProviderSchema.safeParse({}).success).toBe(false)
  })

  it('verified 또는 active 중 하나면 통과한다', () => {
    expect(adminUpdateProviderSchema.safeParse({ verified: true }).success).toBe(true)
    expect(adminUpdateProviderSchema.safeParse({ active: false }).success).toBe(true)
    expect(adminUpdateProviderSchema.safeParse({ verified: false, active: true }).success).toBe(
      true
    )
  })
})

describe('formatKrw', () => {
  it('null·undefined 는 협의로 표기한다', () => {
    expect(formatKrw(null)).toBe('협의')
    expect(formatKrw(undefined)).toBe('협의')
  })

  it('숫자는 천 단위 구분과 원화 기호로 표기한다', () => {
    expect(formatKrw(0)).toBe('₩0')
    expect(formatKrw(1_500_000)).toBe('₩1,500,000')
  })
})

describe('formatBudgetRange', () => {
  it('둘 다 없으면 협의로 표기한다', () => {
    expect(formatBudgetRange(null, null)).toBe('협의')
  })

  it('둘 다 있으면 범위로 표기한다', () => {
    expect(formatBudgetRange(1_000_000, 3_000_000)).toBe('₩1,000,000 ~ ₩3,000,000')
  })

  it('최소만 있으면 이상으로 표기한다', () => {
    expect(formatBudgetRange(2_000_000, null)).toBe('₩2,000,000 이상')
  })

  it('최대만 있으면 이하로 표기한다', () => {
    expect(formatBudgetRange(null, 5_000_000)).toBe('₩5,000,000 이하')
  })
})
