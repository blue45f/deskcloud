import { describe, expect, it } from 'vitest'

import {
  FULL_VERIFICATION_MATRIX,
  ROLE_MANUALS,
  SAMPLE_SITES,
  SAMPLE_UX_CHECKS,
  TUTORIALS,
} from '@/data/docsContent'

describe('DocsPage content contracts', () => {
  it('keeps tutorials, manuals, and sample UX checks broad enough for operators', () => {
    expect(TUTORIALS.map((tutorial) => tutorial.title)).toContain('TermsDesk 약관 의뢰 중계 접근')
    expect(ROLE_MANUALS.map((manual) => manual.audience).toSorted()).toEqual([
      '개발자',
      '약관 운영자',
      '운영자',
      '플랫폼 관리자',
    ])
    expect(SAMPLE_UX_CHECKS.length).toBeGreaterThanOrEqual(6)

    for (const manual of ROLE_MANUALS) {
      expect(manual.href).toMatch(/^#/)
      expect(manual.outcome.length).toBeGreaterThan(40)
      expect(manual.steps.length).toBeGreaterThanOrEqual(4)
      expect(manual.checks.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('keeps live sample sites pointed at the production portal and TermsDesk runtime', () => {
    expect(SAMPLE_SITES.map((sample) => sample.href)).toEqual(
      expect.arrayContaining([
        'https://desk-platform.vercel.app',
        'https://termsdesk.vercel.app/app/marketplace',
        'https://termsdesk.vercel.app/experts',
        'https://desk-platform.vercel.app/api/workspace-desks',
      ])
    )
  })

  it('documents an end-to-end verification matrix for integrated surfaces', () => {
    const areas = FULL_VERIFICATION_MATRIX.map((item) => item.area)

    expect(areas).toEqual(
      expect.arrayContaining([
        '공개 포털',
        '문서 허브',
        'Desk 카탈로그',
        'TermsDesk 마이크로사이트',
        'TermsDesk 의뢰 중계',
        'Workspace manifest API',
        '운영 콘솔',
        '문의 관리 보드',
        '디자인 시스템',
        '통합 빌드/테스트',
      ])
    )

    for (const item of FULL_VERIFICATION_MATRIX) {
      expect(item.entry.length).toBeGreaterThan(0)
      expect(item.expected.length).toBeGreaterThan(25)
      expect(item.proof.length).toBeGreaterThan(20)
      expect(item.command).toMatch(/^(curl|pnpm)/)
    }
  })
})
