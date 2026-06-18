import { Check, Copy } from 'lucide-react'
import { useState } from 'react'

import { cn } from '@/utils/cn'

/** 임베드/통합 스니펫 등 복사 가능한 코드 블록. 우상단에 복사 버튼. */
export function CodeBlock({
  code,
  language = 'ts',
  className,
}: {
  code: string
  language?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-surface-2',
        className
      )}
    >
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code)
          setCopied(true)
          window.setTimeout(() => setCopied(false), 1400)
        }}
        className="absolute top-2.5 right-2.5 z-10 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-muted shadow-xs transition-colors hover:border-border-strong hover:text-text focus-visible:ring-2 focus-visible:ring-accent-strong"
        aria-label="스니펫 복사"
      >
        {copied ? (
          <>
            <Check className="size-3.5 text-success" /> 복사됨
          </>
        ) : (
          <>
            <Copy className="size-3.5" /> 복사
          </>
        )}
      </button>
      <pre
        // 가로 스크롤 영역 — 키보드 사용자가 포커스해 스크롤(WCAG 2.1.1)하도록 tabIndex 필요(axe 요구).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- 스크롤 영역은 region role+tabIndex 정당
        tabIndex={0}
        role="region"
        aria-label={`${language} 코드 스니펫`}
        className="overflow-x-auto p-4 pt-12 text-[0.8125rem] leading-relaxed focus-visible:ring-2 focus-visible:ring-accent-strong focus-visible:outline-none"
      >
        <code className={cn('font-mono text-text', `language-${language}`)}>{code}</code>
      </pre>
    </div>
  )
}
