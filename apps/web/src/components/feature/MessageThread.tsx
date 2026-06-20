import { RotateCcw, Trash2 } from 'lucide-react'

import type { MessageDto } from '@chatdesk/shared'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { clockTime, formatDate } from '@/utils/format'

/** 같은 날짜끼리 묶어 표시하기 위한 그룹. */
interface DayGroup {
  date: string
  items: MessageDto[]
}

function groupByDay(items: MessageDto[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const m of items) {
    const date = formatDate(m.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.items.push(m)
    else groups.push({ date, items: [m] })
  }
  return groups
}

/**
 * 어드민 메시지 뷰어 — 대화의 메시지를 날짜별로 묶어 보여 주고, 운영자가 각 메시지를
 * 모더레이션(soft delete)하거나 복원(undelete)할 수 있다. 시스템 메시지는 가운데 정렬 칩으로,
 * 삭제된 메시지는 "삭제됨" 배지와 함께 **원문을 흐리게** 보여 준다 — 운영자가 무엇이
 * 삭제됐는지 검토할 수 있도록(어드민 히스토리는 원문을 함께 내려준다).
 */
export function MessageThread({
  messages,
  onModerate,
  onRestore,
  moderatingId,
  restoringId,
}: {
  messages: MessageDto[]
  onModerate: (message: MessageDto) => void
  onRestore?: (message: MessageDto) => void
  moderatingId?: string | null
  restoringId?: string | null
}) {
  const groups = groupByDay(messages)

  return (
    <ol className="space-y-5">
      {groups.map((g) => (
        <li key={g.date}>
          <div className="mb-3 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            <span className="text-[0.6875rem] font-medium text-text-subtle">{g.date}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <ul className="space-y-2.5">
            {g.items.map((m) => (
              <li key={m.id}>
                {m.system ? (
                  <div className="flex justify-center">
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-center text-xs text-text-muted">
                      {m.deleted ? '삭제된 시스템 메시지' : m.body}
                      <span className="ml-2 font-mono text-[0.625rem] text-text-subtle">
                        {clockTime(m.createdAt)}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="group flex items-start gap-2.5">
                    <span
                      className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.625rem] font-semibold text-accent-fg"
                      aria-hidden
                    >
                      {(m.senderMemberId ?? '?').slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="truncate font-mono text-xs font-medium text-text">
                          {m.senderMemberId ?? '알 수 없음'}
                        </span>
                        <span className="font-mono text-[0.625rem] text-text-subtle">
                          {clockTime(m.createdAt)}
                        </span>
                        {m.deleted ? (
                          <Badge tone="danger" size="sm">
                            삭제됨
                          </Badge>
                        ) : null}
                      </div>
                      <p
                        className={
                          m.deleted
                            ? 'mt-0.5 text-sm text-text-subtle line-through'
                            : 'mt-0.5 text-sm text-pretty text-text'
                        }
                      >
                        {/* 삭제된 메시지도 운영자에겐 원문을 보여 준다(어드민 히스토리는 원문 포함).
                            본문이 비어 있는(레거시) 경우만 안내 문구로 폴백한다. */}
                        {m.deleted && !m.body
                          ? '이 메시지는 모더레이션으로 삭제되었습니다.'
                          : m.body}
                      </p>
                      {m.attachments.length > 0 ? (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                          {m.attachments.map((a) => (
                            <li key={a.url}>
                              <a
                                href={a.url}
                                target="_blank"
                                rel="noreferrer noopener"
                                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs text-text-muted hover:text-text"
                              >
                                {a.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    {m.deleted ? (
                      onRestore ? (
                        <Tooltip content="이 메시지를 복원(모더레이션 취소)합니다">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => onRestore(m)}
                            loading={restoringId === m.id}
                            aria-label={`${m.senderMemberId ?? '메시지'} 복원`}
                            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                          >
                            <RotateCcw className="size-3.5 text-text-muted" />
                          </Button>
                        </Tooltip>
                      ) : null
                    ) : (
                      <Tooltip content="이 메시지를 삭제(모더레이션)합니다">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => onModerate(m)}
                          loading={moderatingId === m.id}
                          aria-label={`${m.senderMemberId ?? '메시지'} 삭제`}
                          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 className="size-3.5 text-danger" />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}
