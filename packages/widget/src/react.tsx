/**
 * @changelogdesk/widget/react — <ChangelogWidget> 컴포넌트.
 *
 * 우하단(기본)에 떠 있는 "벨" 버튼(미읽음 배지) → 접근성 팝오버 패널.
 * 패널에는 최근 게시 항목이 태그 칩(new/improved/fixed/news)·버전·날짜·마크다운
 * 본문과 함께 최신순으로 보인다. 열면 미읽음을 0으로 만드는 seen 을 기록한다.
 * loading / list / empty / error 상태 + "더 보기" 증분 로드.
 *
 * 인증은 퍼블리시 키(pk_…)뿐 — 브라우저 노출 안전. 의존성은 react(peer)뿐,
 * 외부 CSS 프레임워크 0(스코프 인라인 스타일).
 */
import { markdownToSafeHtml } from '@changelogdesk/shared'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
} from 'react'

import { getAnonId } from './anon'
import { createChangelogDeskClient, type ChangelogDeskClient } from './client'
import { formatEntryDate, tagLabel } from './format'
import { AlertIcon, BellIcon, CloseIcon, EmptyIcon } from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

import type { ChangelogEntryDto } from '@changelogdesk/shared'

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface ChangelogWidgetProps {
  /** 테넌트 퍼블리시 키(pk_…) — 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://changelog.example.com'. */
  endpoint: string
  /** launcher 위치. 기본 bottom-right. */
  position?: WidgetPosition
  /** 강조색(버튼/링크). 기본 #2f5fe0. accent 위 텍스트는 accentInk 로 보정. */
  accent?: string
  /** accent 위 텍스트색(대비 보장용). 기본 흰색. */
  accentInk?: string
  /** 패널 헤더 제목. 기본 "What's new". */
  title?: string
  /** launcher 버튼 접근성 라벨. 기본 "변경 이력". */
  label?: string
  /** 한 페이지 항목 수(기본 20). */
  pageSize?: number
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). 주면 publishableKey/endpoint 보다 우선. */
  client?: ChangelogDeskClient
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'

const POSITION_CLASS: Record<WidgetPosition, string> = {
  'bottom-right': 'cd-pos-br',
  'bottom-left': 'cd-pos-bl',
  'top-right': 'cd-pos-tr',
  'top-left': 'cd-pos-tl',
}

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** 한 항목 — 태그 칩·버전·날짜·새니타이즈된 마크다운 본문. */
function EntryItem({ entry }: { entry: ChangelogEntryDto }): ReactElement {
  // 서버가 bodyHtml(새니타이즈 완료)을 주면 그대로, 없으면 안전 렌더러로 변환.
  const html = useMemo(
    () => entry.bodyHtml || markdownToSafeHtml(entry.bodyMarkdown ?? ''),
    [entry.bodyHtml, entry.bodyMarkdown]
  )
  const date = formatEntryDate(entry.publishedAt ?? entry.createdAt)

  return (
    <article className="cd-entry">
      <div className="cd-entry-top">
        <span className={`cd-tag cd-tag-${entry.tag}`}>{tagLabel(entry.tag)}</span>
        {entry.version ? <span className="cd-ver">{entry.version}</span> : null}
        {date ? (
          <time className="cd-date" dateTime={entry.publishedAt ?? entry.createdAt}>
            {date}
          </time>
        ) : null}
      </div>
      <h3 className="cd-entry-title">{entry.title}</h3>
      {/* 서버/공유 새니타이저가 raw HTML 을 전부 이스케이프하므로 주입이 안전하다. */}
      {html ? <div className="cd-md" dangerouslySetInnerHTML={{ __html: html }} /> : null}
    </article>
  )
}

function Skeletons(): ReactElement {
  return (
    <div aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div className="cd-skeleton" key={i}>
          <div className="cd-sk-line" style={{ width: '40%' }} />
          <div className="cd-sk-line" style={{ width: '85%' }} />
          <div className="cd-sk-line" style={{ width: '70%' }} />
        </div>
      ))}
    </div>
  )
}

export function ChangelogWidget(props: ChangelogWidgetProps): ReactElement | null {
  const {
    publishableKey,
    endpoint,
    position = 'bottom-right',
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    title = "What's new",
    label = '변경 이력',
    pageSize = 20,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<ChangelogDeskClient>(
    () =>
      injectedClient ?? createChangelogDeskClient({ publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, publishableKey, endpoint, customFetch]
  )

  const anonId = useMemo(() => getAnonId(), [])

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [entries, setEntries] = useState<ChangelogEntryDto[]>([])
  const [total, setTotal] = useState(0)
  const [tenantName, setTenantName] = useState<string | null>(null)
  const [unread, setUnread] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const theme: WidgetTheme = { accent, accentInk }
  const titleId = useId()

  const panelRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)

  // 스타일 1회 주입(브라우저에서만)
  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  // 미읽음 카운트 폴링(마운트 시 1회 — 닫혀 있어도 배지를 채움)
  useEffect(() => {
    const ctrl = new AbortController()
    client
      .getUnreadCount(anonId, ctrl.signal)
      .then((r) => setUnread(r.unreadCount))
      .catch(() => {
        // 배지는 실패해도 조용히 둔다(위젯 자체는 열 수 있어야 함).
      })
    return () => ctrl.abort()
  }, [client, anonId])

  const loadEntries = useCallback(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    client
      .listEntries({ limit: pageSize }, ctrl.signal)
      .then((res) => {
        setEntries(res.items)
        setTotal(res.total)
        setTenantName(res.tenant?.name ?? null)
        setPhase('ready')
        // 열었으니 최신 항목까지 읽음 처리 → 배지 0
        const latest = res.items[0]
        client.markSeen({ anonId, lastSeenEntryId: latest?.id }).catch(() => undefined)
        setUnread(0)
      })
      .catch(() => {
        if (ctrl.signal.aborted) return
        setPhase('error')
      })
    return ctrl
  }, [client, pageSize, anonId])

  const loadMore = useCallback(() => {
    const oldest = entries[entries.length - 1]
    setLoadingMore(true)
    client
      .listEntries({ limit: pageSize })
      .then((res) => {
        // since 가 없는 단순 페이지네이션 대신, 이미 받은 id 를 제외하고 합친다.
        const seen = new Set(entries.map((x) => x.id))
        const merged = [...entries, ...res.items.filter((x) => !seen.has(x.id))]
        setEntries(merged)
        setTotal(res.total)
      })
      .catch(() => undefined)
      .finally(() => setLoadingMore(false))
    void oldest
  }, [client, entries, pageSize])

  const openPanel = useCallback(() => {
    setOpen(true)
    if (phase === 'idle' || phase === 'error') loadEntries()
    else {
      // 이미 로드돼 있으면 다시 열 때도 읽음 처리
      const latest = entries[0]
      client.markSeen({ anonId, lastSeenEntryId: latest?.id }).catch(() => undefined)
      setUnread(0)
    }
  }, [phase, loadEntries, entries, client, anonId])

  const closePanel = useCallback(() => {
    setOpen(false)
    launcherRef.current?.focus()
  }, [])

  // Esc 닫기 + 포커스 트랩
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        closePanel()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      )
      if (nodes.length === 0) return
      const first = nodes[0]!
      const last = nodes[nodes.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [open, closePanel])

  // 열리면 패널 안으로 포커스 이동
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const root = panelRef.current
      if (!root) return
      const target = root.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }, 20)
    return () => window.clearTimeout(t)
  }, [open, phase])

  const rootStyle = themeVars(theme) as CSSProperties
  const hasMore = entries.length < total

  return (
    <div className="cd-root" style={rootStyle}>
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          className={`cd-launcher ${POSITION_CLASS[position]}`}
          aria-haspopup="dialog"
          aria-label={unread > 0 ? `${label} — 새 소식 ${unread}건` : label}
          onClick={openPanel}
        >
          <BellIcon />
          {unread > 0 ? (
            <span className="cd-badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </span>
          ) : null}
        </button>
      ) : null}

      {open ? (
        <>
          {/* 장식용 스크림 — 포인터 전용 편의 닫기. 키보드/AT 사용자는 Esc 또는
              닫기 버튼으로 닫으므로(둘 다 존재) aria-hidden 으로 AT 트리에서 제외한다. */}
          <div
            className="cd-backdrop"
            aria-hidden="true"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) closePanel()
            }}
          />
          <div
            ref={panelRef}
            className={`cd-panel ${POSITION_CLASS[position]}`}
            role="dialog"
            aria-modal="false"
            aria-labelledby={titleId}
          >
            <div className="cd-header">
              <div className="cd-header-text">
                <h2 className="cd-title" id={titleId}>
                  {title}
                </h2>
                {tenantName ? <p className="cd-subtitle">{tenantName}</p> : null}
              </div>
              <button type="button" className="cd-close" aria-label="닫기" onClick={closePanel}>
                <CloseIcon />
              </button>
            </div>

            <div className="cd-body">
              {phase === 'loading' ? (
                <div aria-busy="true">
                  <Skeletons />
                </div>
              ) : null}

              {phase === 'error' ? (
                <div className="cd-state" role="alert">
                  <div className="cd-state-icon cd-err">
                    <AlertIcon />
                  </div>
                  <h3 className="cd-state-title">불러오지 못했어요</h3>
                  <p className="cd-state-text">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
                  <button type="button" className="cd-retry" onClick={() => loadEntries()}>
                    다시 시도
                  </button>
                </div>
              ) : null}

              {phase === 'ready' && entries.length === 0 ? (
                <div className="cd-state" role="status">
                  <div className="cd-state-icon">
                    <EmptyIcon />
                  </div>
                  <h3 className="cd-state-title">아직 소식이 없어요</h3>
                  <p className="cd-state-text">새로운 변경 이력이 게시되면 여기에 표시됩니다.</p>
                </div>
              ) : null}

              {phase === 'ready' && entries.length > 0
                ? entries.map((entry) => <EntryItem key={entry.id} entry={entry} />)
                : null}
            </div>

            <div className="cd-footer">
              <a
                className="cd-brand"
                href="https://github.com"
                target="_blank"
                rel="noreferrer noopener"
              >
                ChangelogDesk
              </a>
              <span className="cd-footer-spacer" />
              {phase === 'ready' && hasMore ? (
                <button type="button" className="cd-more" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? '불러오는 중…' : '더 보기'}
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
