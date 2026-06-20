import { describe, expect, it } from 'vitest'

import { groupHits } from './use-search'

import type { SearchHitDto } from '@searchdesk/shared'

function hit(id: string, category: string | null, tags: string[] = []): SearchHitDto {
  return {
    id,
    index: 'default',
    title: id,
    titleHighlight: id,
    url: null,
    category,
    tags,
    attrs: null,
    snippet: null,
    score: 1,
  }
}

describe('groupHits', () => {
  it('카테고리별로 묶고 첫 등장 순서를 보존한다', () => {
    const groups = groupHits([
      hit('a', 'guide'),
      hit('b', 'docs'),
      hit('c', 'guide'),
      hit('d', 'docs'),
    ])
    expect(groups.map((g) => g.category)).toEqual(['guide', 'docs'])
    expect(groups[0]!.hits.map((h) => h.id)).toEqual(['a', 'c'])
    expect(groups[1]!.hits.map((h) => h.id)).toEqual(['b', 'd'])
  })

  it('category 가 없으면 기타 그룹으로 모은다', () => {
    const groups = groupHits([hit('a', null), hit('b', 'docs'), hit('c', null)])
    const other = groups.find((g) => g.category === '기타')
    expect(other?.hits.map((h) => h.id)).toEqual(['a', 'c'])
  })

  it('빈 배열은 빈 그룹 목록', () => {
    expect(groupHits([])).toEqual([])
  })

  it('그룹을 평탄화하면 입력 순서를 카테고리 그룹 순으로 재배열한다(키보드 인덱스)', () => {
    const groups = groupHits([hit('a', 'g1'), hit('b', 'g2'), hit('c', 'g1')])
    const flat = groups.flatMap((g) => g.hits.map((h) => h.id))
    expect(flat).toEqual(['a', 'c', 'b'])
  })
})
