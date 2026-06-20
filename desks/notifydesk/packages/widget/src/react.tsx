/**
 * @notifydesk/widget/react — <NotificationBell> 컴포넌트.
 *
 * 알림 벨 + 미읽음 배지(unread-count 폴링) → 클릭 시 접근성 인박스 드롭다운.
 * 드롭다운은 최신 알림 목록(상대 시간), 열릴 때/클릭 시 읽음 처리, 빈/에러/로딩 상태를 다룬다.
 *
 * 의존성은 react(peer)뿐. 외부 CSS 프레임워크 0(스코프 .nd-* 스타일).
 */
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

import { createNotifyDeskWidgetClient, type NotifyDeskWidgetClient } from './client'
import { AlertIcon, BellIcon, CheckAllIcon, CloseIcon, EmptyBellIcon } from './icons'
import { formatRelativeTime } from './relative-time'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'

import type { NotificationDto } from '@notifydesk/shared'

export type WidgetAlign = 'right' | 'left'

export interface NotificationBellProps {
  /** 알림을 받을 사용자(테넌트 측 식별자). 예: 'user_42'. */
  recipientId: string
  /** publishable 키(`pk_…`). 브라우저 노출 안전. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://notify.example.com'. */
  endpoint: string
  /** 드롭다운 정렬(벨 기준). 기본 'right'. */
  align?: WidgetAlign
  /** 강조색(배지/포커스). 기본 #2f5fe0. accent 위 텍스트는 accentInk 로 보정. */
  accent?: string
  /** accent 위 텍스트색(대비 보장용). 기본 흰색. */
  accentInk?: string
  /** 벨 버튼 접근성 라벨. 기본 '알림'. */
  label?: string
  /** 미읽음 카운트 폴링 주기(ms). 기본 30000. 0 이하면 폴링 끔. */
  pollIntervalMs?: number
  /** 인박스 목록 최대 건수. 기본 20(서버 최대 100). */
  limit?: number
  /** 배지에 표시할 최대 숫자(초과 시 'N+'). 기본 99. */
  maxBadge?: number
  /** 알림 클릭 콜백(읽음 처리 후 호출) — 라우팅 등에 사용. */
  onNotificationClick?: (notification: NotificationDto) => void
  /** 미읽음 카운트 변화 콜백(파비콘 배지 등). */
  onUnreadChange?: (count: number) => void
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). 주면 recipientId/endpoint 보다 우선. */
  client?: NotifyDeskWidgetClient
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

export function NotificationBell(props: NotificationBellProps): ReactElement {
  const {
    recipientId,
    publishableKey,
    endpoint,
    align = 'right',
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    label = '알림',
    pollIntervalMs = 30_000,
    limit = 20,
    maxBadge = 99,
    onNotificationClick,
    onUnreadChange,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<NotifyDeskWidgetClient>(
    () =>
      injectedClient ??
      createNotifyDeskWidgetClient({ recipientId, publishableKey, endpoint, fetch: customFetch }),
    [injectedClient, recipientId, publishableKey, endpoint, customFetch]
  )

  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [items, setItems] = useState<NotificationDto[]>([])
  const [unread, setUnread] = useState(0)

  const theme: WidgetTheme = { accent, accentInk }
  const titleId = useId()

  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLButtonElement>(null)
  // 콜백 ref 로 보관 — effect 의존성을 안정화해 폴링 타이머 재시작을 막는다.
  const onUnreadChangeRef = useRef(onUnreadChange)
  onUnreadChangeRef.current = onUnreadChange

  // 스타일 1회 주입(브라우저에서만)
  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  const applyUnread = useCallback((n: number) => {
    setUnread(n)
    onUnreadChangeRef.current?.(n)
  }, [])

  // 미읽음 카운트 폴링(닫혀 있어도 동작 — 배지 갱신)
  useEffect(() => {
    let cancelled = false
    const ctrl = new AbortController()

    const tick = (): void => {
      client
        .getUnreadCount(ctrl.signal)
        .then((r) => {
          if (!cancelled) applyUnread(r.unreadCount)
        })
        .catch(() => {
          /* 폴링 실패는 조용히 무시 — 다음 틱에서 복구 */
        })
    }

    tick()
    let timer: ReturnType<typeof setInterval> | undefined
    if (pollIntervalMs > 0) timer = setInterval(tick, pollIntervalMs)

    return () => {
      cancelled = true
      ctrl.abort()
      if (timer) clearInterval(timer)
    }
  }, [client, pollIntervalMs, applyUnread])

  const loadInbox = useCallback(() => {
    const ctrl = new AbortController()
    setPhase('loading')
    client
      .getInbox(limit, ctrl.signal)
      .then((inbox) => {
        if (ctrl.signal.aborted) return
        setItems(inbox.items)
        applyUnread(inbox.unreadCount)
        setPhase('ready')
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted || (e as Error)?.name === 'AbortError') return
        setPhase('error')
      })
    return ctrl
  }, [client, limit, applyUnread])

  // 열릴 때: 인박스 로드 + 미읽음을 낙관적으로 읽음 처리
  const openPanel = useCallback(() => {
    setOpen(true)
    const ctrl = loadInbox()
    // 패널을 여는 행위 = "확인" → 미읽음 전체를 읽음 처리(낙관적 UI + 서버 반영)
    if (unread > 0) {
      setItems((prev) => prev.map((it) => (it.status === 'read' ? it : markItemRead(it))))
      applyUnread(0)
      client
        .markAllRead()
        .then((r) => applyUnread(r.unreadCount))
        .catch(() => {
          /* 실패 시 다음 폴링/리로드에서 실제 값으로 복구 */
        })
    }
    return ctrl
  }, [loadInbox, unread, client, applyUnread])

  const closePanel = useCallback(() => {
    setOpen(false)
    bellRef.current?.focus()
  }, [])

  const toggle = useCallback(() => {
    if (open) closePanel()
    else openPanel()
  }, [open, openPanel, closePanel])

  // Esc 닫기 + 포커스 트랩 + 바깥 클릭 닫기
  useEffect(() => {
    if (!open) return

    const onKey = (e: KeyboardEvent): void => {
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

    const onPointer = (e: MouseEvent): void => {
      const root = rootRef.current
      if (root && !root.contains(e.target as Node)) closePanel()
    }

    document.addEventListener('keydown', onKey, true)
    document.addEventListener('mousedown', onPointer, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onPointer, true)
    }
  }, [open, closePanel])

  // 열리면 패널 안으로 포커스 이동(첫 포커스 가능 요소)
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

  const handleItemClick = useCallback(
    (item: NotificationDto) => {
      if (item.status !== 'read') {
        setItems((prev) => prev.map((it) => (it.id === item.id ? markItemRead(it) : it)))
        applyUnread(Math.max(0, unread - 1))
        client
          .markRead([item.id])
          .then((r) => applyUnread(r.unreadCount))
          .catch(() => undefined)
      }
      onNotificationClick?.(item)
    },
    [client, unread, applyUnread, onNotificationClick]
  )

  const rootStyle = themeVars(theme) as CSSProperties
  const badgeText = unread > maxBadge ? `${maxBadge}+` : String(unread)
  const hasUnread = unread > 0

  return (
    <div className="nd-root" style={rootStyle} ref={rootRef}>
      <button
        ref={bellRef}
        type="button"
        className="nd-bell"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={hasUnread ? `${label}, 읽지 않은 알림 ${unread}건` : label}
        onClick={toggle}
      >
        <BellIcon />
        {hasUnread ? (
          <span className="nd-badge" aria-hidden="true">
            {badgeText}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className={`nd-panel ${align === 'left' ? 'nd-align-left' : 'nd-align-right'}`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <div className="nd-panel-header">
            <h2 className="nd-panel-title" id={titleId}>
              {label}
            </h2>
            <span className="nd-panel-spacer" />
            <button
              type="button"
              className="nd-mark-all"
              disabled={!hasUnread}
              onClick={() => {
                setItems((prev) => prev.map((it) => (it.status === 'read' ? it : markItemRead(it))))
                applyUnread(0)
                client
                  .markAllRead()
                  .then((r) => applyUnread(r.unreadCount))
                  .catch(() => undefined)
              }}
            >
              <CheckAllIcon />
              모두 읽음
            </button>
            <button type="button" className="nd-panel-close" aria-label="닫기" onClick={closePanel}>
              <CloseIcon />
            </button>
          </div>

          {phase === 'loading' && items.length === 0 ? (
            <div className="nd-state" aria-busy="true">
              <div className="nd-spinner" />
              <p className="nd-state-text" style={{ marginTop: 12 }}>
                알림을 불러오는 중…
              </p>
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="nd-state" role="alert">
              <div className="nd-state-icon nd-err">
                <AlertIcon />
              </div>
              <h3 className="nd-state-title">알림을 불러오지 못했어요</h3>
              <p className="nd-state-text">네트워크 상태를 확인해 주세요.</p>
              <button type="button" className="nd-retry" onClick={() => loadInbox()}>
                다시 시도
              </button>
            </div>
          ) : null}

          {phase === 'ready' && items.length === 0 ? (
            <div className="nd-state">
              <div className="nd-state-icon">
                <EmptyBellIcon />
              </div>
              <h3 className="nd-state-title">새 알림이 없어요</h3>
              <p className="nd-state-text">알림이 도착하면 여기에 표시됩니다.</p>
            </div>
          ) : null}

          {items.length > 0 ? (
            <ul className="nd-list">
              {items.map((item) => {
                const isUnread = item.status !== 'read'
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`nd-item ${isUnread ? 'nd-unread' : 'nd-read'}`}
                      onClick={() => handleItemClick(item)}
                    >
                      <span className="nd-dot" aria-hidden="true" />
                      <span className="nd-item-body">
                        {item.title ? <p className="nd-item-title">{item.title}</p> : null}
                        {item.body ? <p className="nd-item-text">{item.body}</p> : null}
                        <p className="nd-item-time">
                          <time dateTime={item.createdAt}>
                            {formatRelativeTime(item.createdAt)}
                          </time>
                          {isUnread ? <span className="nd-sr-only"> · 읽지 않음</span> : null}
                        </p>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/** 알림을 읽음 상태로 표시한 새 객체를 반환(불변 갱신). */
function markItemRead(item: NotificationDto): NotificationDto {
  return { ...item, status: 'read', readAt: item.readAt ?? new Date().toISOString() }
}
