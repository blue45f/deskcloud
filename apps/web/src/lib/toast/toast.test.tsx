/* @vitest-environment jsdom */

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ToastProvider } from './ToastProvider'
import { useToast } from './useToast'

function Trigger() {
  const toast = useToast()
  return (
    <button type="button" onClick={() => toast.show({ message: '저장했습니다', tone: 'success' })}>
      띄우기
    </button>
  )
}

describe('ToastProvider + useToast', () => {
  it('shows a toast on demand and lets the user dismiss it', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    )

    expect(screen.queryByText('저장했습니다')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '띄우기' }))
    // 본문 + 스크린리더 영역 두 곳에 노출된다.
    expect(screen.getAllByText('저장했습니다').length).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '알림 닫기' }))
    expect(screen.queryByText('저장했습니다')).toBeNull()
  })

  it('falls back to a no-op API outside a provider', () => {
    function StandaloneTrigger() {
      const toast = useToast()
      return (
        <button type="button" onClick={() => expect(toast.show('hi')).toBe('')}>
          noop
        </button>
      )
    }
    render(<StandaloneTrigger />)
    // throw 하지 않으면 통과.
    fireEvent.click(screen.getByRole('button', { name: 'noop' }))
  })
})
