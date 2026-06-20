import { useId, useRef, useState } from 'react'

import type { ReactElement } from 'react'

import { IconCheck, IconCopy } from '@/components/icons'

export interface CodeTab {
  id: string
  label: string
  code: string
}

interface CopyButtonProps {
  code: string
  /** 복사 대상 설명(스크린리더용). */
  label: string
}

/** 클립보드 복사 버튼 — 성공 시 2초간 "복사됨" 상태. navigator 미지원이면 숨김. */
function CopyButton({ code, label }: CopyButtonProps): ReactElement | null {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (typeof navigator === 'undefined' || !navigator.clipboard) return null

  const copy = (): void => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      className={copied ? 'fd-copy-btn fd-copied' : 'fd-copy-btn'}
      onClick={copy}
      aria-label={copied ? `${label} 복사됨` : `${label} 복사`}
    >
      {copied ? <IconCheck /> : <IconCopy />}
      <span aria-hidden="true">{copied ? '복사됨' : '복사'}</span>
    </button>
  )
}

/**
 * 탭 + 복사 버튼이 달린 코드 블록.
 * - 탭 1개면 탭 바를 생략하고 단일 코드 + 복사 버튼만 보여준다.
 * - 탭은 role="tab"/"tablist"/"tabpanel" 로 마크업(키보드/스크린리더).
 */
export function CodeBlock({
  tabs,
  copyLabel = '코드',
}: {
  tabs: CodeTab[]
  copyLabel?: string
}): ReactElement {
  const [active, setActive] = useState(0)
  const groupId = useId()
  const current = tabs[active] ?? tabs[0]

  // 빈 배열은 호출 측 실수 — 렌더할 코드가 없으면 아무것도 그리지 않는다.
  if (!current) return <></>

  if (tabs.length === 1) {
    return (
      <div className="fd-codeblock">
        <div className="fd-codeblock-body">
          <CopyButton code={current.code} label={copyLabel} />
          <pre className="fd-code">{current.code}</pre>
        </div>
      </div>
    )
  }

  return (
    <div className="fd-codeblock">
      <div className="fd-codeblock-bar" role="tablist" aria-label={copyLabel}>
        {tabs.map((tab, index) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${groupId}-tab-${tab.id}`}
            aria-selected={index === active}
            aria-controls={`${groupId}-panel-${tab.id}`}
            tabIndex={index === active ? 0 : -1}
            className="fd-codetab"
            onClick={() => setActive(index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="fd-codeblock-body"
        role="tabpanel"
        id={`${groupId}-panel-${current.id}`}
        aria-labelledby={`${groupId}-tab-${current.id}`}
      >
        <CopyButton code={current.code} label={`${current.label} ${copyLabel}`} />
        <pre className="fd-code">{current.code}</pre>
      </div>
    </div>
  )
}
