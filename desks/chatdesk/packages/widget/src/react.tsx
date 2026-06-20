/**
 * @chatdesk/widget/react — <ChatWidget> 컴포넌트.
 *
 * 우하단(기본)에 떠 있는 채팅 런처(+unread 배지) → 패널:
 *   - 대화 목록(unread 배지·미리보기·시각)
 *   - 메시지 스레드(히스토리 + 라이브 + 타이핑 + 읽음 리시트 + presence)
 *   - 작성기(타이핑 전송·엔터 발송)
 *
 * pk + memberId 로 @chatdesk/sdk 의 ChatClient 를 만들고, conversations()·open() 으로
 * 실시간 메시징을 구동한다. 의존성은 react(peer)·@chatdesk/sdk 뿐. 외부 CSS 프레임워크 0.
 *
 * 접근성: focus-visible · prefers-reduced-motion · 포커스 트랩 · Esc 닫기 · 키보드 ·
 * 새 메시지 aria-live(polite) · 대비 ≥4.5:1.
 */

import {
  createChatClient,
  type ChatClient,
  type ConversationRoom,
  type MessageDto,
} from '@chatdesk/sdk'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactElement,
} from 'react'

import { clockTime, conversationName, dayLabel, previewText, sameDate, shortTime } from './format'
import {
  AlertIcon,
  BackIcon,
  ChatIcon,
  CheckDoubleIcon,
  CloseIcon,
  GroupIcon,
  PersonIcon,
  SendIcon,
} from './icons'
import {
  DEFAULT_ACCENT,
  DEFAULT_ACCENT_INK,
  ensureStyles,
  themeVars,
  type WidgetTheme,
} from './styles'
import { pingVisit } from './track'

import type { ConversationListItemDto } from '@chatdesk/shared'

export type WidgetPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'

export interface ChatWidgetProps {
  /** publishable 키(pk_…) — 브라우저용. */
  publishableKey: string
  /** API 베이스 URL. 예: 'https://chat.example.com'. */
  endpoint: string
  /** 이 사용자(호스트 앱의 멤버 id). */
  memberId: string
  /** 표시 이름(선택, 헤더/안내용). 미지정 시 memberId. */
  memberName?: string
  /** socket.io 경로(서버 CHAT_PATH 와 일치). 기본 '/chat'. */
  path?: string
  /** 호스트 서버가 sk 로 발급한 멤버 토큰(선택, 강화 인증). */
  memberToken?: string
  /** launcher 위치. 기본 bottom-right. */
  position?: WidgetPosition
  /** 강조색. 기본 #2f5fe0. accent 위 텍스트는 accentInk 로 보정. */
  accent?: string
  /** accent 위 텍스트색(대비 보장용). 기본 흰색. */
  accentInk?: string
  /** launcher 라벨. 기본 '채팅'. */
  label?: string
  /** 패널 헤더 제목(목록 화면). 기본 '메시지'. */
  title?: string
  /** 처음부터 열린 상태로. 기본 false. */
  defaultOpen?: boolean
  /** 커스텀 fetch(SSR/테스트). */
  fetch?: typeof fetch
  /** 외부에서 만든 클라이언트 주입(테스트/공유용). 주면 키/엔드포인트보다 우선. */
  client?: ChatClient
}

const POSITION_CLASS: Record<WidgetPosition, string> = {
  'bottom-right': 'cd-pos-br',
  'bottom-left': 'cd-pos-bl',
  'top-right': 'cd-pos-tr',
  'top-left': 'cd-pos-tl',
}

const FOCUSABLE =
  'a[href],area[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),[tabindex]:not([tabindex="-1"])'

type ListPhase = 'idle' | 'loading' | 'ready' | 'error'

export function ChatWidget(props: ChatWidgetProps): ReactElement {
  const {
    publishableKey,
    endpoint,
    memberId,
    memberName,
    path,
    memberToken,
    position = 'bottom-right',
    accent = DEFAULT_ACCENT,
    accentInk = DEFAULT_ACCENT_INK,
    label = '채팅',
    title = '메시지',
    defaultOpen = false,
    fetch: customFetch,
    client: injectedClient,
  } = props

  const client = useMemo<ChatClient>(
    () =>
      injectedClient ??
      createChatClient({
        publishableKey,
        memberId,
        endpoint,
        path,
        memberToken,
        fetch: customFetch,
      }),
    [injectedClient, publishableKey, memberId, endpoint, path, memberToken, customFetch]
  )

  const [open, setOpen] = useState(defaultOpen)
  const [listPhase, setListPhase] = useState<ListPhase>('idle')
  const [conversations, setConversations] = useState<ConversationListItemDto[]>([])
  const [totalUnread, setTotalUnread] = useState(0)
  const [activeId, setActiveId] = useState<string | null>(null)

  const theme: WidgetTheme = { accent, accentInk }
  const panelRef = useRef<HTMLDivElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)

  // 스타일 1회 주입(브라우저에서만)
  useEffect(() => {
    if (typeof document !== 'undefined') ensureStyles()
  }, [])

  // 마운트 시 방문 ping 1회(fire-and-forget) — 어드민 대시보드의 트래픽 집계용.
  // pk·endpoint 가 있을 때만(주입 클라이언트 테스트 등은 건너뜀). 실패해도 무시된다.
  useEffect(() => {
    if (publishableKey && endpoint) void pingVisit(endpoint, publishableKey, customFetch)
  }, [publishableKey, endpoint, customFetch])

  const loadConversations = useCallback(
    (signal?: AbortSignal) => {
      setListPhase((p) => (p === 'ready' ? p : 'loading'))
      client
        .conversations(signal)
        .then((res) => {
          if (signal?.aborted) return
          setConversations(res.items)
          setTotalUnread(res.totalUnread)
          setListPhase('ready')
        })
        .catch(() => {
          if (signal?.aborted) return
          setListPhase('error')
        })
    },
    [client]
  )

  // 마운트 시 한 번 unread 를 받아 런처 배지를 채운다(닫혀 있어도).
  useEffect(() => {
    const ctrl = new AbortController()
    loadConversations(ctrl.signal)
    return () => ctrl.abort()
  }, [loadConversations])

  // 알 수 없는 대화 메시지가 도착하면 목록 새로고침을 1회 예약(상태 업데이터는 순수 유지).
  const [refreshTick, setRefreshTick] = useState(0)

  // 글로벌 새 메시지 → 목록 미리보기·unread 갱신(활성 대화가 아니면 unread++).
  useEffect(() => {
    const off = client.onMessage((m) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === m.conversationId)
        if (idx === -1) {
          // 알 수 없는 대화 — 새로고침을 예약(업데이터 밖에서 effect 가 처리). 상태는 그대로.
          setRefreshTick((t) => t + 1)
          return prev
        }
        const isActive = m.conversationId === activeId && open
        const isMine = m.senderMemberId === memberId
        const next = [...prev]
        const conv = next[idx]!
        next[idx] = {
          ...conv,
          lastMessage: m,
          unreadCount: isActive || isMine ? conv.unreadCount : conv.unreadCount + 1,
        }
        // 최근 대화를 맨 위로.
        const [moved] = next.splice(idx, 1)
        next.unshift(moved!)
        return next
      })
    })
    return off
  }, [client, activeId, open, memberId])

  // 알 수 없는 대화로 인한 새로고침 요청 처리(부수효과는 업데이터가 아닌 effect 에서).
  useEffect(() => {
    if (refreshTick === 0) return
    loadConversations()
  }, [refreshTick, loadConversations])

  // totalUnread 는 목록 합으로 파생(라이브 갱신 반영).
  useEffect(() => {
    setTotalUnread(conversations.reduce((sum, c) => sum + c.unreadCount, 0))
  }, [conversations])

  const openPanel = useCallback(() => {
    setOpen(true)
    if (listPhase === 'idle' || listPhase === 'error') loadConversations()
  }, [listPhase, loadConversations])

  const closePanel = useCallback(() => {
    setOpen(false)
    setActiveId(null)
    launcherRef.current?.focus()
  }, [])

  // Esc 닫기 + 포커스 트랩(패널 열렸을 때)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        if (activeId) {
          setActiveId(null)
        } else {
          closePanel()
        }
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
  }, [open, activeId, closePanel])

  // 패널 열리면 안으로 포커스 이동
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      const root = panelRef.current
      if (!root) return
      const target = root.querySelector<HTMLElement>(FOCUSABLE)
      target?.focus()
    }, 20)
    return () => window.clearTimeout(t)
  }, [open, activeId])

  // 대화 열기 — 활성 대화의 unread 를 낙관적으로 0 으로(읽음은 ThreadView 가 markRead).
  const openConversation = useCallback((id: string) => {
    setActiveId(id)
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)))
  }, [])

  const activeConv = activeId ? (conversations.find((c) => c.id === activeId) ?? null) : null
  const rootStyle = themeVars(theme) as CSSProperties
  const posClass = POSITION_CLASS[position]

  return (
    <div className="cd-root" style={rootStyle}>
      {!open ? (
        <button
          ref={launcherRef}
          type="button"
          className={`cd-launcher ${posClass}`}
          aria-haspopup="dialog"
          aria-label={totalUnread > 0 ? `${label} — 안 읽은 메시지 ${totalUnread}개` : label}
          onClick={openPanel}
        >
          <ChatIcon />
          {label}
          {totalUnread > 0 ? (
            <span className="cd-launcher-badge" aria-hidden="true">
              {totalUnread > 99 ? '99+' : totalUnread}
            </span>
          ) : null}
        </button>
      ) : null}

      {open ? (
        <div
          ref={panelRef}
          className={`cd-panel ${posClass}`}
          role="dialog"
          aria-modal="false"
          aria-label={activeConv ? conversationName(activeConv, memberId) : title}
        >
          {activeConv ? (
            <ThreadView
              key={activeConv.id}
              client={client}
              conversation={activeConv}
              memberId={memberId}
              memberName={memberName}
              onBack={() => setActiveId(null)}
              onClose={closePanel}
            />
          ) : (
            <ListView
              title={title}
              phase={listPhase}
              conversations={conversations}
              memberId={memberId}
              onOpen={openConversation}
              onClose={closePanel}
              onRetry={() => loadConversations()}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}

// ── 대화 목록 화면 ────────────────────────────────────────────────────────────

interface ListViewProps {
  title: string
  phase: ListPhase
  conversations: ConversationListItemDto[]
  memberId: string
  onOpen: (id: string) => void
  onClose: () => void
  onRetry: () => void
}

function ListView(props: ListViewProps): ReactElement {
  const { title, phase, conversations, memberId, onOpen, onClose, onRetry } = props
  return (
    <>
      <div className="cd-header">
        <div className="cd-header-title">
          <h2>{title}</h2>
        </div>
        <button type="button" className="cd-iconbtn" aria-label="닫기" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {phase === 'loading' && conversations.length === 0 ? (
        <div className="cd-state" aria-busy="true">
          <div className="cd-spinner" />
          <p className="cd-state-text" style={{ marginTop: 14 }}>
            대화를 불러오는 중…
          </p>
        </div>
      ) : phase === 'error' ? (
        <div className="cd-state">
          <div className="cd-state-icon cd-err">
            <AlertIcon />
          </div>
          <h3 className="cd-state-title">불러오지 못했어요</h3>
          <p className="cd-state-text">네트워크 상태를 확인하고 다시 시도해 주세요.</p>
          <button type="button" className="cd-btn" onClick={onRetry}>
            다시 시도
          </button>
        </div>
      ) : conversations.length === 0 ? (
        <div className="cd-state">
          <div className="cd-state-icon">
            <ChatIcon />
          </div>
          <h3 className="cd-state-title">아직 대화가 없어요</h3>
          <p className="cd-state-text">새 대화가 시작되면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <ul className="cd-list" style={{ listStyle: 'none', margin: 0 }}>
          {conversations.map((c) => {
            const name = conversationName(c, memberId)
            const hasUnread = c.unreadCount > 0
            return (
              <li key={c.id}>
                <button
                  type="button"
                  className="cd-conv"
                  onClick={() => onOpen(c.id)}
                  aria-label={hasUnread ? `${name} — 안 읽은 메시지 ${c.unreadCount}개` : name}
                >
                  <span className="cd-avatar" aria-hidden="true">
                    {c.kind === 'group' ? <GroupIcon /> : <PersonIcon />}
                  </span>
                  <span className="cd-conv-body">
                    <span className="cd-conv-top">
                      <span className="cd-conv-name">{name}</span>
                      {c.lastMessage ? (
                        <span className="cd-conv-time">{shortTime(c.lastMessage.createdAt)}</span>
                      ) : null}
                    </span>
                    <span className={`cd-conv-preview ${hasUnread ? 'cd-unread' : ''}`}>
                      {previewText(c)}
                    </span>
                  </span>
                  {hasUnread ? (
                    <span className="cd-badge" aria-hidden="true">
                      {c.unreadCount > 99 ? '99+' : c.unreadCount}
                    </span>
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

// ── 메시지 스레드 화면 ────────────────────────────────────────────────────────

interface ThreadViewProps {
  client: ChatClient
  conversation: ConversationListItemDto
  memberId: string
  memberName?: string
  onBack: () => void
  onClose: () => void
}

type ThreadPhase = 'loading' | 'ready' | 'error'

function ThreadView(props: ThreadViewProps): ReactElement {
  const { client, conversation, memberId, onBack, onClose } = props
  const conversationId = conversation.id

  const [phase, setPhase] = useState<ThreadPhase>('loading')
  const [messages, setMessages] = useState<MessageDto[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [typingMembers, setTypingMembers] = useState<string[]>([])
  const [onlineCount, setOnlineCount] = useState(0)
  /** 상대방이 읽은 마지막 메시지 id 들(읽음 리시트 표시용). memberId → lastReadMessageId */
  const [readBy, setReadBy] = useState<Record<string, string | null>>({})
  const [liveMsg, setLiveMsg] = useState('') // aria-live announce

  const roomRef = useRef<ConversationRoom | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const typingSentRef = useRef(false)
  const typingTimerRef = useRef<number | null>(null)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = threadRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // 대화 열기(히스토리 + join + 구독)
  useEffect(() => {
    let alive = true
    setPhase('loading')
    client
      .open(conversationId)
      .then((room) => {
        if (!alive) {
          void room.close()
          return
        }
        roomRef.current = room
        setMessages(room.messages)
        setHasMore(room.hasMore)
        setPhase('ready')

        room.onMessage((m) => {
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
          if (m.senderMemberId !== memberId) {
            setLiveMsg(`${m.senderMemberId ?? '시스템'}: ${m.body}`)
            // 새 메시지가 오면 즉시 읽음 처리(패널이 열려 있으므로).
            void client.markRead(conversationId, m.id).catch(() => undefined)
          }
        })
        room.onTyping((e) => {
          setTypingMembers((prev) => {
            if (e.typing) return prev.includes(e.memberId) ? prev : [...prev, e.memberId]
            return prev.filter((x) => x !== e.memberId)
          })
        })
        room.onRead((e) => {
          if (e.memberId === memberId) return
          setReadBy((prev) => ({ ...prev, [e.memberId]: e.lastReadMessageId }))
        })
        room.onPresence((count) => setOnlineCount(count))
        room.onMessageDeleted((e) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === e.messageId ? { ...m, deleted: true, body: '' } : m))
          )
        })
        room.onMessageRestored((restored) => {
          setMessages((prev) => prev.map((m) => (m.id === restored.id ? restored : m)))
        })

        // 열자마자 최신까지 읽음 처리.
        void client.markRead(conversationId).catch(() => undefined)
      })
      .catch(() => {
        if (alive) setPhase('error')
      })

    return () => {
      alive = false
      const room = roomRef.current
      roomRef.current = null
      if (room) void room.close()
    }
  }, [client, conversationId, memberId])

  // 메시지 추가/로딩 완료 시 하단으로 스크롤
  useEffect(() => {
    if (phase === 'ready') scrollToBottom()
  }, [messages.length, phase, scrollToBottom])

  // 타이핑 정리(언마운트)
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
      if (typingSentRef.current) client.typing(conversationId, false)
    }
  }, [client, conversationId])

  const signalTyping = useCallback(() => {
    if (!typingSentRef.current) {
      typingSentRef.current = true
      client.typing(conversationId, true)
    }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
    typingTimerRef.current = window.setTimeout(() => {
      typingSentRef.current = false
      client.typing(conversationId, false)
    }, 2500)
  }, [client, conversationId])

  const doSend = useCallback(() => {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    // 타이핑 종료 신호
    if (typingSentRef.current) {
      typingSentRef.current = false
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current)
      client.typing(conversationId, false)
    }
    client
      .send(conversationId, body)
      .then(() => {
        setDraft('')
        // 메시지는 WS 브로드캐스트(onMessage)로 추가된다.
      })
      .catch(() => {
        setLiveMsg('메시지 전송에 실패했습니다.')
      })
      .finally(() => {
        setSending(false)
        composerRef.current?.focus()
      })
  }, [draft, sending, client, conversationId])

  const onComposerKey = useCallback(
    (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault()
        doSend()
      }
    },
    [doSend]
  )

  const fetchOlder = useCallback(() => {
    const room = roomRef.current
    if (!room) return
    const el = threadRef.current
    const prevHeight = el?.scrollHeight ?? 0
    void room.fetchOlder().then((older) => {
      if (older.length === 0) {
        setHasMore(false)
        return
      }
      setMessages(room.messages)
      setHasMore(room.hasMore)
      // 스크롤 위치 보정(prepend 후)
      window.setTimeout(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight
      }, 0)
    })
  }, [])

  // 내가 보낸 마지막 메시지가 상대에게 읽혔는지 — 더블체크 색 결정.
  const myLastMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]!
      if (m.senderMemberId === memberId && !m.deleted) return m.id
    }
    return null
  }, [messages, memberId])

  const lastReadByOthers = useMemo(
    () => new Set(Object.values(readBy).filter(Boolean) as string[]),
    [readBy]
  )

  const headerName = conversationName(conversation, memberId)
  const subtitle =
    conversation.kind === 'group'
      ? onlineCount > 0
        ? `${onlineCount}명 접속 중`
        : `멤버 ${conversation.memberIds.length}명`
      : onlineCount > 1
        ? '접속 중'
        : '오프라인'
  const subOnline = onlineCount > (conversation.kind === 'group' ? 0 : 1)

  return (
    <>
      <div className="cd-header">
        <button type="button" className="cd-iconbtn" aria-label="대화 목록으로" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="cd-header-title">
          <h2>{headerName}</h2>
          <p className={`cd-header-sub ${subOnline ? 'cd-online' : ''}`}>{subtitle}</p>
        </div>
        <button type="button" className="cd-iconbtn" aria-label="닫기" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      {phase === 'error' ? (
        <div className="cd-state">
          <div className="cd-state-icon cd-err">
            <AlertIcon />
          </div>
          <h3 className="cd-state-title">대화를 열 수 없어요</h3>
          <p className="cd-state-text">이 대화의 멤버가 아니거나 연결에 문제가 있습니다.</p>
          <button type="button" className="cd-btn" onClick={onBack}>
            목록으로
          </button>
        </div>
      ) : (
        <>
          <div className="cd-thread" ref={threadRef}>
            {phase === 'loading' ? (
              <div className="cd-state" aria-busy="true">
                <div className="cd-spinner" />
              </div>
            ) : (
              <>
                {hasMore ? (
                  <button type="button" className="cd-loadmore" onClick={fetchOlder}>
                    이전 메시지 더 보기
                  </button>
                ) : null}
                {messages.map((m, i) => {
                  const prev = messages[i - 1]
                  const showDay = !prev || !sameDate(prev.createdAt, m.createdAt)
                  return (
                    <MessageRow
                      key={m.id}
                      message={m}
                      mine={m.senderMemberId === memberId}
                      showDay={showDay}
                      showSender={conversation.kind === 'group'}
                      isMyLast={m.id === myLastMessageId}
                      readByOthers={lastReadByOthers.has(m.id)}
                    />
                  )
                })}
                {typingMembers.length > 0 ? (
                  <>
                    <div className="cd-typing" aria-hidden="true">
                      <span /> <span /> <span />
                    </div>
                    <p className="cd-typing-text">
                      {conversation.kind === 'group'
                        ? `${typingMembers.join(', ')} 님이 입력 중…`
                        : '입력 중…'}
                    </p>
                  </>
                ) : null}
              </>
            )}
          </div>

          <form
            className="cd-composer"
            onSubmit={(e) => {
              e.preventDefault()
              doSend()
            }}
          >
            <textarea
              ref={composerRef}
              value={draft}
              rows={1}
              placeholder="메시지를 입력하세요"
              aria-label="메시지 입력"
              onChange={(e) => {
                setDraft(e.target.value)
                signalTyping()
              }}
              onKeyDown={onComposerKey}
            />
            <button
              type="submit"
              className="cd-send"
              aria-label="보내기"
              disabled={!draft.trim() || sending}
            >
              <SendIcon />
            </button>
          </form>
        </>
      )}

      {/* 스크린리더 전용 — 새 메시지/상태 안내 */}
      <div className="cd-sr-only" role="status" aria-live="polite" aria-atomic="true">
        {liveMsg}
      </div>
    </>
  )
}

// ── 단일 메시지 행 ────────────────────────────────────────────────────────────

interface MessageRowProps {
  message: MessageDto
  mine: boolean
  showDay: boolean
  showSender: boolean
  isMyLast: boolean
  readByOthers: boolean
}

function MessageRow(props: MessageRowProps): ReactElement {
  const { message: m, mine, showDay, showSender, isMyLast, readByOthers } = props
  const rowClass = m.system ? 'cd-system' : mine ? 'cd-mine' : 'cd-theirs'

  return (
    <>
      {showDay ? <div className="cd-day">{dayLabel(m.createdAt)}</div> : null}
      <div className={`cd-msg-row ${rowClass}`}>
        {!m.system && !mine && showSender ? (
          <span className="cd-msg-sender">{m.senderMemberId}</span>
        ) : null}
        <div className={`cd-bubble ${m.deleted ? 'cd-deleted' : ''}`}>
          {m.deleted ? '삭제된 메시지입니다' : m.body}
          {!m.deleted && m.attachments.length > 0
            ? m.attachments.map((a, idx) => (
                <a
                  key={`${a.url}-${idx}`}
                  className="cd-attach"
                  href={a.url}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  📎 {a.name}
                </a>
              ))
            : null}
        </div>
        {!m.system ? (
          <span className="cd-msg-meta">
            {clockTime(m.createdAt)}
            {mine && isMyLast ? <CheckDoubleIconWrap read={readByOthers} /> : null}
          </span>
        ) : null}
      </div>
    </>
  )
}

function CheckDoubleIconWrap({ read }: { read: boolean }): ReactElement {
  return (
    <span
      className={`cd-receipt ${read ? 'cd-read' : ''}`}
      style={{ display: 'inline-flex' }}
      aria-label={read ? '읽음' : '전송됨'}
      title={read ? '읽음' : '전송됨'}
    >
      <CheckDoubleIcon />
    </span>
  )
}
