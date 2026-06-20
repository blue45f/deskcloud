import { describe, expect, it } from 'vitest'

import {
  createInquirySchema,
  inquiryCategories,
  inquiryStatuses,
  updateInquirySchema,
} from './inquiry'

const validInput = {
  category: 'contact',
  title: '입점 문의드립니다',
  body: '병원 정보 등록 절차가 궁금합니다. 안내 부탁드립니다.',
} as const

describe('inquiry schemas', () => {
  it('카테고리·상태 어휘를 고정한다', () => {
    expect(inquiryCategories).toEqual(['contact', 'partnership', 'bug', 'qa', 'question'])
    expect(inquiryStatuses).toEqual(['new', 'in_progress', 'closed'])
  })

  it('정상 접수를 트림·정규화한다', () => {
    const parsed = createInquirySchema.parse({
      ...validInput,
      title: '  입점 문의드립니다  ',
      contactEmail: 'kim@example.com',
      originUrl: ' https://pettography.vercel.app/contact ',
    })
    expect(parsed.title).toBe('입점 문의드립니다')
    expect(parsed.contactEmail).toBe('kim@example.com')
    expect(parsed.originUrl).toBe('https://pettography.vercel.app/contact')
  })

  it("연락 이메일 빈 문자열('')은 미입력(undefined)으로 변환한다", () => {
    const parsed = createInquirySchema.parse({ ...validInput, contactEmail: '' })
    expect(parsed.contactEmail).toBeUndefined()
    expect(
      createInquirySchema.safeParse({ ...validInput, contactEmail: 'not-an-email' }).success
    ).toBe(false)
  })

  it('폼 클라이언트의 null 선택 필드를 미입력(undefined)으로 변환한다', () => {
    const parsed = createInquirySchema.parse({
      ...validInput,
      contactEmail: null,
      originUrl: null,
      website: null,
    })

    expect(parsed.contactEmail).toBeUndefined()
    expect(parsed.originUrl).toBeUndefined()
    expect(parsed.website).toBeUndefined()
  })

  it('허니팟(website)은 스키마를 통과한다 — 폐기는 서버 몫', () => {
    const parsed = createInquirySchema.parse({ ...validInput, website: 'http://spam.example' })
    expect(parsed.website).toBe('http://spam.example')
  })

  it('제목 2..140 · 본문 10..4000 길이 경계를 지킨다', () => {
    const body = validInput.body
    expect(createInquirySchema.safeParse({ ...validInput, title: '가' }).success).toBe(false)
    expect(createInquirySchema.safeParse({ ...validInput, title: '가나' }).success).toBe(true)
    expect(createInquirySchema.safeParse({ ...validInput, title: '가'.repeat(140) }).success).toBe(
      true
    )
    expect(createInquirySchema.safeParse({ ...validInput, title: '가'.repeat(141) }).success).toBe(
      false
    )
    expect(createInquirySchema.safeParse({ ...validInput, body: '가'.repeat(9) }).success).toBe(
      false
    )
    expect(createInquirySchema.safeParse({ ...validInput, body: '가'.repeat(10) }).success).toBe(
      true
    )
    expect(createInquirySchema.safeParse({ ...validInput, body: '가'.repeat(4001) }).success).toBe(
      false
    )
    expect(createInquirySchema.safeParse({ ...validInput, body }).success).toBe(true)
  })

  it('수정은 status/adminNote 중 하나는 있어야 한다 (adminNote=null 은 메모 제거)', () => {
    expect(updateInquirySchema.safeParse({}).success).toBe(false)
    expect(updateInquirySchema.safeParse({ status: 'in_progress' }).success).toBe(true)
    expect(updateInquirySchema.safeParse({ adminNote: null }).success).toBe(true)
    expect(updateInquirySchema.safeParse({ status: 'reopened' }).success).toBe(false)
    const parsed = updateInquirySchema.parse({ status: 'closed', adminNote: ' 처리 완료 ' })
    expect(parsed.adminNote).toBe('처리 완료')
  })
})
