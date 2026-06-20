import { describe, expect, it } from 'vitest'

import { filterPostsBySearch, matchesPostSearch } from './postSearch'

import type { AdminPostDto } from '@communitydesk/shared'

function post(overrides: Partial<AdminPostDto>): AdminPostDto {
  return {
    id: 'p1',
    tenantId: 't1',
    boardId: 'b1',
    boardSlug: 'free',
    authorMemberId: 'm1',
    authorName: '홍길동',
    title: '안녕하세요',
    body: '첫 글입니다',
    bodyHtml: '<p>첫 글입니다</p>',
    tags: ['공지'],
    pinned: false,
    locked: false,
    status: 'visible',
    reactions: {},
    replyCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('matchesPostSearch', () => {
  it('빈 키워드는 항상 통과한다', () => {
    expect(matchesPostSearch(post({}), '')).toBe(true)
    expect(matchesPostSearch(post({}), '   ')).toBe(true)
  })

  it('제목·작성자·본문·태그를 부분 일치(대소문자 무시)로 거른다', () => {
    const p = post({
      title: 'Release Notes',
      authorName: 'Jane',
      body: 'hello world',
      tags: ['v2'],
    })
    expect(matchesPostSearch(p, 'release')).toBe(true)
    expect(matchesPostSearch(p, 'JANE')).toBe(true)
    expect(matchesPostSearch(p, 'world')).toBe(true)
    expect(matchesPostSearch(p, 'v2')).toBe(true)
    expect(matchesPostSearch(p, 'nomatch')).toBe(false)
  })

  it('여러 토큰은 AND 로 모두 만족해야 한다', () => {
    const p = post({ title: '버그 리포트', authorName: '김철수', body: '재현 절차' })
    expect(matchesPostSearch(p, '버그 김철수')).toBe(true)
    expect(matchesPostSearch(p, '버그 없음')).toBe(false)
  })

  it('제목이 null 이어도 다른 필드로 매칭된다', () => {
    const p = post({ title: null, authorName: '익명', body: '내용' })
    expect(matchesPostSearch(p, '익명')).toBe(true)
    expect(matchesPostSearch(p, '내용')).toBe(true)
  })
})

describe('filterPostsBySearch', () => {
  const posts = [
    post({ id: '1', title: '공지사항', authorName: '운영자', body: '점검 안내', tags: ['notice'] }),
    post({ id: '2', title: '자유글', authorName: '홍길동', body: '잡담', tags: ['free'] }),
  ]

  it('빈 키워드는 원본 배열을 그대로 돌려준다', () => {
    expect(filterPostsBySearch(posts, '')).toBe(posts)
  })

  it('키워드에 맞는 글만 남긴다', () => {
    const result = filterPostsBySearch(posts, '공지')
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('1')
  })
})
