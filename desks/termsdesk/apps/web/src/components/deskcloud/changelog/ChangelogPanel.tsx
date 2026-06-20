/**
 * ChangelogDesk — 네이티브 "변경 이력" 패널.
 * ──────────────────────────────────────────────────────────────────────────
 * @heejun/deskcloud 의 타입드 브라우저 클라이언트(createChangelogClient)로 데이터를
 * 가져와 TermsDesk 자체 컴포넌트(Dialog · Badge · Button · Spinner)와 디자인 토큰으로
 * 렌더합니다. 위젯 임베드/외부 CSS 가 아니라 앱 네이티브 UI 입니다.
 *
 * 활성 조건: VITE_CHANGELOGDESK_URL 이 설정된 경우에만(services/deskcloud).
 * 본문은 Desk 백엔드가 서버 사이드로 새니타이즈한 bodyHtml 을 우선 사용합니다.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { type ChangelogEntry, type ChangelogEntryTag } from '@heejun/deskcloud'
import { useQuery } from '@tanstack/react-query'
import { Megaphone, Sparkles } from 'lucide-react'
import { Fragment, useEffect, useState, type ReactNode } from 'react'

import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, Spinner } from '@/components/ui/feedback'
import { getChangelogClient } from '@/services/deskcloud'
import { getAnonId } from '@/utils/anonId'
import { formatDate } from '@/utils/format'

const PAGE_SIZE = 20

const TAG_META: Record<
  ChangelogEntryTag,
  { label: string; tone: NonNullable<BadgeProps['tone']> }
> = {
  new: { label: '신규', tone: 'accent' },
  improved: { label: '개선', tone: 'success' },
  fixed: { label: '수정', tone: 'info' },
  announcement: { label: '공지', tone: 'warning' },
}

function tagMeta(tag: string): { label: string; tone: NonNullable<BadgeProps['tone']> } {
  return TAG_META[tag as ChangelogEntryTag] ?? { label: tag, tone: 'neutral' }
}

const SAFE_LINK = /^(https?:\/\/|mailto:|\/|#)/i

/**
 * 한 줄의 인라인 마크다운(**bold** · `code` · [text](href))을 React 노드로 변환.
 * raw HTML 은 일절 주입하지 않으므로(텍스트는 React 가 자동 이스케이프) XSS 가 없습니다.
 */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // **bold** | `code` | [text](href)
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1] != null) {
      nodes.push(
        <strong key={`${keyBase}-b-${i}`} className="font-semibold text-text">
          {m[1]}
        </strong>
      )
    } else if (m[2] != null) {
      nodes.push(
        <code
          key={`${keyBase}-c-${i}`}
          className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.75rem]"
        >
          {m[2]}
        </code>
      )
    } else if (m[3] != null && m[4] != null && SAFE_LINK.test(m[4].trim())) {
      nodes.push(
        <a
          key={`${keyBase}-a-${i}`}
          href={m[4].trim()}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-accent-strong underline"
        >
          {m[3]}
        </a>
      )
    } else if (m[3] != null) {
      nodes.push(m[3])
    }
    last = re.lastIndex
    i += 1
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

/** 변경 이력 본문(마크다운 텍스트)을 문단·불릿 목록으로 안전하게 렌더(raw HTML X). */
function ChangelogBody({ markdown }: { markdown: string }) {
  const blocks: ReactNode[] = []
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  let bullets: string[] = []

  const flushBullets = (key: string) => {
    if (bullets.length === 0) return
    const list = bullets
    bullets = []
    blocks.push(
      <ul key={`ul-${key}`} className="my-1.5 list-disc pl-5">
        {list.map((b, bi) => (
          <li key={bi} className="my-0.5">
            {renderInline(b, `li-${key}-${bi}`)}
          </li>
        ))}
      </ul>
    )
  }

  lines.forEach((raw, idx) => {
    const line = raw.trim()
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      bullets.push(bullet[1]!)
      return
    }
    flushBullets(String(idx))
    if (line.length > 0) {
      blocks.push(
        <p key={`p-${idx}`} className="my-1">
          {renderInline(line, `p-${idx}`)}
        </p>
      )
    }
  })
  flushBullets('end')

  return (
    <div className="prose-measure mt-1 text-[0.8125rem] leading-relaxed text-text-muted">
      {blocks.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
    </div>
  )
}

function EntryCard({ entry }: { entry: ChangelogEntry }) {
  const meta = tagMeta(entry.tag)
  const date = entry.publishedAt ?? entry.createdAt
  return (
    <article className="border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <Badge tone={meta.tone} size="sm">
          {meta.label}
        </Badge>
        {entry.version ? (
          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[0.6875rem] text-text-muted">
            {entry.version}
          </span>
        ) : null}
        <time className="ml-auto text-[0.6875rem] text-text-subtle" dateTime={date}>
          {formatDate(date)}
        </time>
      </div>
      <h3 className="text-sm font-semibold text-text">{entry.title}</h3>
      {entry.bodyMarkdown ? <ChangelogBody markdown={entry.bodyMarkdown} /> : null}
    </article>
  )
}

export interface ChangelogPanelProps {
  /** 패널 열림 상태(제어형). */
  open: boolean
  /** 닫기 콜백. */
  onOpenChange: (open: boolean) => void
  /** 미확인 개수 변화 콜백(런처 배지 갱신용). */
  onUnreadChange?: (count: number) => void
}

/**
 * 변경 이력 패널. 열려 있을 때만 목록을 조회하고, 열리면 현재 최신 항목까지
 * "읽음"으로 표시해 미확인 배지를 0 으로 만듭니다.
 */
export function ChangelogPanel({ open, onOpenChange, onUnreadChange }: ChangelogPanelProps) {
  const [anonId] = useState(getAnonId)

  const wall = useQuery({
    queryKey: ['deskcloud', 'changelog', 'wall'],
    enabled: open,
    queryFn: ({ signal }) => {
      const client = getChangelogClient()
      if (!client) throw new Error('Changelog 통합이 비활성화되어 있습니다.')
      return client.getWall({ limit: PAGE_SIZE, signal })
    },
  })

  // 패널이 열리면 최신 항목을 본 것으로 표시 → 미확인 배지 0.
  useEffect(() => {
    if (!open) return
    const latest = wall.data?.items[0]
    const client = getChangelogClient()
    if (!client) return
    let cancelled = false
    client
      .markSeen({ anonId, lastSeenEntryId: latest?.id })
      .then(() => {
        if (!cancelled) onUnreadChange?.(0)
      })
      .catch(() => {
        // 읽음 표시 실패는 조용히 무시(다음 폴링에서 복구)
      })
    return () => {
      cancelled = true
    }
  }, [open, wall.data, anonId, onUnreadChange])

  const items = wall.data?.items ?? []
  const tenantName = wall.data?.tenant.name

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent sheet className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>변경 이력</DialogTitle>
          <DialogDescription>
            {tenantName ? `${tenantName}의 ` : ''}새로운 소식과 업데이트를 확인하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {wall.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-muted">
              <Spinner />
              불러오는 중…
            </div>
          ) : wall.isError ? (
            <EmptyState
              icon={Megaphone}
              title="불러오지 못했어요"
              description="네트워크 상태를 확인하고 다시 시도해 주세요."
              action={
                <Button variant="outline" size="sm" onClick={() => void wall.refetch()}>
                  다시 시도
                </Button>
              }
            />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="아직 소식이 없어요"
              description="새로운 변경 이력이 게시되면 여기에 표시됩니다."
            />
          ) : (
            <div>
              {items.map((entry) => (
                <EntryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default ChangelogPanel
