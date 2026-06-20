import { useId, useRef, useState } from 'react'

import { CopyButton } from './CopyButton'

import type { KeyboardEvent, ReactElement } from 'react'

export interface Snippet {
  /** 탭 식별자. */
  id: string
  /** 탭 라벨(짧게). */
  label: string
  /** 코드 본문. */
  code: string
}

interface SnippetTabsProps {
  snippets: Snippet[]
  /** 접근성: 탭 그룹 라벨. */
  ariaLabel: string
}

/**
 * 스니펫 탭 — 설치/React/SDK/바닐라 임베드 코드를 한 곳에서 전환·복사한다.
 *
 * WAI-ARIA 탭 패턴: roving tabindex + ←/→/Home/End 키보드 내비게이션, 선택 탭만 tabbable.
 * 각 패널은 우상단 복사 버튼을 가진다. (랜딩의 "데이터 어포던스" 기능 1)
 */
export function SnippetTabs({ snippets, ariaLabel }: SnippetTabsProps): ReactElement {
  const [active, setActive] = useState(0)
  const baseId = useId()
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const focusTab = (index: number): void => {
    const next = (index + snippets.length) % snippets.length
    setActive(next)
    tabRefs.current[next]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number): void => {
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        focusTab(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        focusTab(index - 1)
        break
      case 'Home':
        event.preventDefault()
        focusTab(0)
        break
      case 'End':
        event.preventDefault()
        focusTab(snippets.length - 1)
        break
      default:
        break
    }
  }

  // active 는 항상 유효 인덱스지만, noUncheckedIndexedAccess 하에선 안전 폴백을 둔다.
  const current = snippets[active] ?? snippets[0]
  if (!current) return <div />

  return (
    <div>
      <div className="ad-tabs" role="tablist" aria-label={ariaLabel}>
        {snippets.map((snippet, index) => {
          const selected = index === active
          return (
            <button
              key={snippet.id}
              ref={(el) => {
                tabRefs.current[index] = el
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${snippet.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${snippet.id}`}
              tabIndex={selected ? 0 : -1}
              className="ad-tab"
              onClick={() => setActive(index)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {snippet.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${current.id}`}
        aria-labelledby={`${baseId}-tab-${current.id}`}
        className="ad-codeblock"
        tabIndex={0}
      >
        <CopyButton value={current.code} label={`${current.label} 스니펫`} />
        <pre className="ad-code ad-code-tall">{current.code}</pre>
      </div>
    </div>
  )
}
