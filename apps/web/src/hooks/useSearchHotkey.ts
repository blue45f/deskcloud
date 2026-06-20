import { useEffect } from 'react'

/** 헤더 검색 입력에 부여하는 공유 id — 핫키가 이 요소를 찾아 포커스한다. */
export const SEARCH_INPUT_ID = 'global-search-input'

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true
  )
}

/**
 * 전역 검색 단축키.
 * - `/` 또는 `Ctrl/Cmd+K`: 어디서든(입력 중이 아니면) 검색창으로 포커스 이동.
 * - 검색창에서 `Esc`: 입력을 지우고 포커스 해제.
 * 입력/텍스트영역에 타이핑 중일 때는 `/`를 가로채지 않아 일반 타이핑을 방해하지 않는다.
 */
export function useSearchHotkey(onClear: () => void) {
  useEffect(() => {
    const focusSearch = () => {
      const input = document.getElementById(SEARCH_INPUT_ID)
      if (input instanceof HTMLInputElement) {
        input.focus()
        input.select()
        return true
      }
      return false
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const isSlash = event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
      const isCommandK = event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)

      if ((isSlash && !isTypingTarget(event.target)) || isCommandK) {
        if (focusSearch()) event.preventDefault()
        return
      }

      if (
        event.key === 'Escape' &&
        event.target instanceof HTMLElement &&
        event.target.id === SEARCH_INPUT_ID
      ) {
        onClear()
        event.target.blur()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [onClear])
}
