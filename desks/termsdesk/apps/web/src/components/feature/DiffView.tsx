import { diffLines, diffWordsWithSpace } from 'diff'
import { useMemo, type ReactNode } from 'react'

import { cn } from '@/utils/cn'

interface Line {
  type: 'add' | 'remove' | 'same'
  text: string
  /** 단어 단위 강조 토큰(추가/삭제 줄에서 변경 부분만 짙게). 동일 줄은 undefined. */
  segments?: { text: string; changed: boolean }[]
  /** 원본(before) 줄 번호. 추가 줄은 null. */
  oldNo: number | null
  /** 변경본(after) 줄 번호. 삭제 줄은 null. */
  newNo: number | null
}

/**
 * 인접한 삭제↔추가 줄 쌍에 단어 단위 diff 를 입혀 "무엇이 바뀌었는지"를 짚어줍니다.
 * (조항 한 줄에서 단어 몇 개만 바뀐 경우, 줄 전체가 빨강/초록으로 칠해지는 노이즈를 줄임.)
 */
function annotateWordChanges(lines: Line[]): void {
  for (let i = 0; i < lines.length - 1; i++) {
    const a = lines[i]
    const b = lines[i + 1]
    if (a?.type !== 'remove' || b?.type !== 'add') continue
    const parts = diffWordsWithSpace(a.text, b.text)
    a.segments = parts
      .filter((p) => !p.added)
      .map((p) => ({ text: p.value, changed: Boolean(p.removed) }))
    b.segments = parts
      .filter((p) => !p.removed)
      .map((p) => ({ text: p.value, changed: Boolean(p.added) }))
  }
}

function buildLines(before: string, after: string): Line[] {
  const changes = diffLines(before || '', after || '')
  const lines: Line[] = []
  let oldNo = 0
  let newNo = 0
  for (const part of changes) {
    const type: Line['type'] = part.added ? 'add' : part.removed ? 'remove' : 'same'
    const raw = part.value.split('\n')
    // 마지막 빈 토큰 제거(문자열 끝 개행)
    if (raw.length > 0 && raw[raw.length - 1] === '') raw.pop()
    for (const text of raw) {
      const oldLineNo = type === 'add' ? null : ++oldNo
      const newLineNo = type === 'remove' ? null : ++newNo
      lines.push({ type, text, oldNo: oldLineNo, newNo: newLineNo })
    }
  }
  annotateWordChanges(lines)
  return lines
}

function LineText({ line }: { line: Line }): ReactNode {
  if (!line.segments) return line.text || ' '
  return line.segments.map((seg, i) => (
    <span
      key={i}
      className={cn(
        seg.changed &&
          (line.type === 'add'
            ? 'rounded-sm bg-success/25 font-medium'
            : 'rounded-sm bg-danger/25 font-medium')
      )}
    >
      {seg.text}
    </span>
  ))
}

export function DiffView({ before, after }: { before: string; after: string }) {
  const lines = useMemo(() => buildLines(before, after), [before, after])
  const added = lines.filter((l) => l.type === 'add').length
  const removed = lines.filter((l) => l.type === 'remove').length
  const unchanged = added === 0 && removed === 0

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-4 py-2 text-xs text-text-muted">
        <span className="font-medium text-text">변경 내용</span>
        {unchanged ? (
          <span className="text-text-subtle">두 버전의 본문이 동일합니다</span>
        ) : (
          <>
            <span className="text-success">+{added}</span>
            <span className="text-danger">−{removed}</span>
            <span className="ml-auto text-text-subtle">
              {added + removed}줄 변경 · 단어 단위 강조
            </span>
          </>
        )}
      </div>
      <div className="overflow-x-auto bg-surface font-mono text-[0.8125rem] leading-relaxed">
        {lines.map((line, i) => (
          <div
            key={i}
            className={cn(
              'flex',
              line.type === 'add' && 'bg-success-soft',
              line.type === 'remove' && 'bg-danger-soft'
            )}
          >
            <span
              className="w-9 shrink-0 select-none border-r border-border/60 px-1.5 text-right text-text-subtle/70 tabular-nums"
              aria-hidden
            >
              {line.oldNo ?? ''}
            </span>
            <span
              className="w-9 shrink-0 select-none border-r border-border/60 px-1.5 text-right text-text-subtle/70 tabular-nums"
              aria-hidden
            >
              {line.newNo ?? ''}
            </span>
            <span
              className={cn(
                'w-6 shrink-0 select-none border-r border-border/60 px-2 text-center',
                line.type === 'add' && 'text-success',
                line.type === 'remove' && 'text-danger',
                line.type === 'same' && 'text-text-subtle'
              )}
              aria-hidden
            >
              {line.type === 'add' ? '+' : line.type === 'remove' ? '−' : ''}
            </span>
            <span
              className={cn(
                'whitespace-pre-wrap px-3 py-0.5',
                line.type === 'same' ? 'text-text-muted' : 'text-text'
              )}
            >
              <LineText line={line} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
