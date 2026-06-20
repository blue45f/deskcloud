import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StatCard } from './StatCard'

/**
 * StatCard 는 운영 현황·테넌트 지표 패널의 공통 카드다.
 * a11y: 라벨이 부여된 group 으로, 값/설명이 함께 읽혀야 한다(색 단독 의존 아님).
 */
describe('StatCard', () => {
  it('라벨·값·설명을 렌더하고 라벨 group 으로 노출한다', () => {
    render(<StatCard label="오늘 방문자" value="1,234" hint="오늘(KST) 고유 방문" />)

    expect(screen.getByText('오늘 방문자')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByText('오늘(KST) 고유 방문')).toBeInTheDocument()

    // role="group" + aria-labelledby 로 라벨이 그룹에 연결된다(스크린리더가 "라벨, 값").
    const group = screen.getByRole('group', { name: '오늘 방문자' })
    expect(group).toBeInTheDocument()
  })
})
