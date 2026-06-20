// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { MiniBarChart, type MiniBarPoint } from './MiniBarChart'

// vitest globals 미사용이라 @testing-library/react 의 자동 act 환경/cleanup 등록이 안 걸림 — 직접 설정.
const actGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
actGlobal.IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

const points = (values: number[]): MiniBarPoint[] =>
  values.map((value, i) => ({
    key: `2026-06-${String(i + 1).padStart(2, '0')}`,
    label: `6월 ${i + 1}일 · ${value}건`,
    value,
  }))

describe('MiniBarChart (외부 차트 라이브러리 없는 CSS 스파크 바)', () => {
  it('포인트 수만큼 바를 그리고 role/aria-label 로 요약을 노출한다', () => {
    const { container } = render(
      <MiniBarChart points={points([0, 2, 5, 0, 1])} ariaLabel="최근 5일 동의 추이, 총 8건" />
    )

    expect(screen.getByRole('img', { name: '최근 5일 동의 추이, 총 8건' })).toBeDefined()
    expect(container.querySelectorAll('[data-bar]')).toHaveLength(5)
  })

  it('값이 0 인 날도 고스트 바로 자리를 유지한다 (연속 구간 보존)', () => {
    const { container } = render(<MiniBarChart points={points([0, 3])} ariaLabel="테스트 추이" />)

    const bars = container.querySelectorAll<HTMLElement>('[data-bar]')
    expect(bars[0]!.style.height).toBe('3px') // 0건 — 고스트
    expect(bars[1]!.style.height).toBe('100%') // 최대값 — 풀 높이
  })

  it('호버 타이틀에 일자·건수 라벨을 담는다', () => {
    const { container } = render(<MiniBarChart points={points([4])} ariaLabel="테스트 추이" />)
    expect(container.querySelector('[title="6월 1일 · 4건"]')).not.toBeNull()
  })

  it('전부 0 이어도 0 나누기 없이 렌더링된다 (신규 조직)', () => {
    const { container } = render(<MiniBarChart points={points([0, 0, 0])} ariaLabel="빈 추이" />)
    const bars = container.querySelectorAll<HTMLElement>('[data-bar]')
    expect(bars).toHaveLength(3)
    for (const bar of bars) expect(bar.style.height).toBe('3px')
  })
})
