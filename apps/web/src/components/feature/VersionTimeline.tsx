import { Lock } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { PolicyVersionSummaryDto } from '@termsdesk/shared'

import { Badge, StatusPill } from '@/components/ui/badge'
import { HashTag } from '@/components/ui/feedback'
import { cn } from '@/utils/cn'
import { formatDate } from '@/utils/format'

export function VersionTimeline({
  versions,
  currentVersionId,
}: {
  versions: PolicyVersionSummaryDto[]
  currentVersionId: string | null
}) {
  const published = versions.filter((v) => v.status === 'published').length
  const drafts = versions.filter((v) => v.status === 'draft').length

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-3 text-xs text-text-muted">
        <span className="font-medium text-text">총 {versions.length}개 버전</span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-full bg-success" aria-hidden />
          게시 {published}
        </span>
        {drafts > 0 ? (
          <span className="flex items-center gap-1">
            <span
              className="size-2 rounded-full border border-border-strong bg-surface"
              aria-hidden
            />
            초안 {drafts}
          </span>
        ) : null}
      </div>
      <ol className="relative">
        {versions.map((v, i) => {
          const isCurrent = v.id === currentVersionId
          const last = i === versions.length - 1
          return (
            <li key={v.id} className="flex gap-3.5">
              <div className="relative flex w-3.5 flex-col items-center pt-2.5">
                <span
                  className={cn(
                    'z-10 size-3.5 rounded-full ring-4 ring-bg',
                    isCurrent
                      ? 'bg-accent'
                      : v.status === 'published'
                        ? 'bg-success'
                        : 'border-2 border-border-strong bg-surface'
                  )}
                />
                {!last ? <span className="w-px flex-1 bg-border" /> : null}
              </div>
              <Link
                to={`/app/versions/${v.id}`}
                className="mb-2 flex-1 rounded-lg border border-transparent px-3 py-2.5 outline-none transition-colors hover:border-border hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent-strong"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono text-sm font-semibold text-text">
                    {v.versionLabel}
                  </span>
                  <StatusPill status={v.status} size="sm" />
                  {isCurrent ? (
                    <Badge tone="accent" size="sm">
                      <Lock className="size-3" />
                      현재 발효
                    </Badge>
                  ) : null}
                  {v.requiresReconsent ? (
                    <Badge tone="warning" size="sm">
                      재동의 필요
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 truncate text-sm text-text">{v.title}</p>
                {v.changeSummary ? (
                  <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">{v.changeSummary}</p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-subtle">
                  <HashTag hash={v.contentHash} />
                  <span>
                    {v.status === 'draft'
                      ? `작성 ${formatDate(v.createdAt)}`
                      : `발효 ${formatDate(v.effectiveAt)}`}
                  </span>
                  {v.publishedByName ? <span>게시자 {v.publishedByName}</span> : null}
                </div>
              </Link>
            </li>
          )
        })}
      </ol>
    </>
  )
}
