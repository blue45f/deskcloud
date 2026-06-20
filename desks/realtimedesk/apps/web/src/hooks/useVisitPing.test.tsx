import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useVisitPing } from './useVisitPing'

const { postAnonymous } = vi.hoisted(() => ({
  postAnonymous: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/services/api', () => ({ api: { postAnonymous } }))

function Probe() {
  useVisitPing()
  return null
}

describe('useVisitPing', () => {
  beforeEach(() => {
    postAnonymous.mockClear()
    localStorage.clear()
  })
  afterEach(() => localStorage.clear())

  it('첫 방문에는 firstToday=true 로 ping 하고 오늘 키를 기록한다', () => {
    render(<Probe />)
    expect(postAnonymous).toHaveBeenCalledTimes(1)
    expect(postAnonymous).toHaveBeenCalledWith('metrics/ping', { firstToday: true })

    // 오늘 방문 키가 localStorage 에 남는다(다음 방문은 firstToday=false).
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('rt-visit-'))
    expect(keys).toHaveLength(1)
  })

  it('오늘 이미 방문했으면 firstToday=false(hit 만)', () => {
    render(<Probe />) // 첫 방문 — 키 기록
    postAnonymous.mockClear()
    render(<Probe />) // 같은 날 두 번째 마운트
    expect(postAnonymous).toHaveBeenCalledWith('metrics/ping', { firstToday: false })
  })
})
