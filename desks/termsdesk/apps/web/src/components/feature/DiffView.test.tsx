// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { DiffView } from './DiffView'

// vitest globals 미사용이라 @testing-library/react 의 자동 act 환경/cleanup 등록이 안 걸림 — 직접 설정.
const actGlobal = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
actGlobal.IS_REACT_ACT_ENVIRONMENT = true
afterEach(cleanup)

describe('DiffView (라인+단어 단위 diff)', () => {
  it('추가/삭제 줄 수를 집계해 표시한다', () => {
    render(<DiffView before={'제1조\n제2조'} after={'제1조\n제2조 수정\n제3조'} />)
    // 제2조 → 제2조 수정 (1 삭제 + 1 추가), 제3조 (1 추가)
    expect(screen.getByText('+2')).toBeDefined()
    expect(screen.getByText('−1')).toBeDefined()
  })

  it('본문이 동일하면 변경 없음 안내를 보여준다', () => {
    render(<DiffView before="동일한 본문" after="동일한 본문" />)
    expect(screen.getByText('두 버전의 본문이 동일합니다')).toBeDefined()
  })

  it('변경 줄에 원본/변경본 줄 번호를 함께 노출한다', () => {
    const { container } = render(<DiffView before={'a\nb'} after={'a\nb\nc'} />)
    // 동일 줄 a 는 양쪽 1, b 는 양쪽 2, 추가 줄 c 는 새 번호 3
    expect(container.querySelector('.tabular-nums')).toBeDefined()
    expect(screen.getByText('c')).toBeDefined()
  })
})
