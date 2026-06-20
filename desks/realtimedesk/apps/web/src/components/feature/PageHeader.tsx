import type { ReactNode } from 'react'

/** 앱 페이지 상단 — 제목 + 설명 + (선택) 우측 액션. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-pretty text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
