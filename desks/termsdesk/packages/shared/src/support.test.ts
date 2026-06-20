import { describe, expect, it } from 'vitest'

import { createSupportPostSchema, supportCategories } from './support'

describe('support schemas', () => {
  it('accepts the three required board categories', () => {
    expect(supportCategories).toEqual(['site-inquiry', 'partnership', 'bug'])
  })

  it('normalizes and validates a public support post', () => {
    const parsed = createSupportPostSchema.parse({
      projectSlug: 'PromptMarket',
      category: 'bug',
      name: '  Kim  ',
      contact: '  kim@example.com  ',
      title: '  Search fails  ',
      body: '  검색 결과가 특정 필터에서 비어 보입니다.  ',
    })

    expect(parsed.projectSlug).toBe('promptmarket')
    expect(parsed.name).toBe('Kim')
    expect(parsed.contact).toBe('kim@example.com')
    expect(parsed.title).toBe('Search fails')
    expect(parsed.body).toBe('검색 결과가 특정 필터에서 비어 보입니다.')
  })

  it('rejects empty contact details because replies need a private channel', () => {
    const parsed = createSupportPostSchema.safeParse({
      projectSlug: 'promptmarket',
      category: 'site-inquiry',
      name: 'Kim',
      contact: '',
      title: '문의',
      body: '서비스 문의를 남깁니다.',
    })

    expect(parsed.success).toBe(false)
  })
})
