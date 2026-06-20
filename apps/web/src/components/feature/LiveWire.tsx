import { Radio, Send, Users } from 'lucide-react'
import { useEffect, useReducer, useRef, useState } from 'react'

import { cn } from '@/utils/cn'

/* ──────────────────────────────────────────────────────────────────────────
   LiveWire — 히어로의 "라이브 와이어" 데모.
   제품(WebSocket pub/sub·presence)을 설명하지 않고 *보여 준다*: 서버가 secret 키로
   채널에 이벤트를 흘려보내면 구독자 콘솔에 메시지가 도착하고, presence 점이 합류·이탈한다.

   - 의존성 0. setInterval + 상태 머신으로 스스로 흐른다.
   - 접근성: 시각 데모는 aria-hidden, 별도의 시각 비표시 텍스트로 의미를 보강.
   - reduced-motion: 흐름 타이머를 멈추고 대표 스냅샷(고정 메시지·presence)을 보여 준다.
   ────────────────────────────────────────────────────────────────────────── */

type WireMessage = { id: number; user: string; text: string; tone: 'accent' | 'success' | 'info' }

type WireScriptItem = Omit<WireMessage, 'id'>

const SCRIPT: readonly [WireScriptItem, ...WireScriptItem[]] = [
  { user: 'kim', text: 'shipped v2 🚀', tone: 'accent' },
  { user: 'server', text: 'presence: 18 online', tone: 'info' },
  { user: 'noah', text: 'typing…', tone: 'success' },
  { user: 'mina', text: 'doc:design 잠금 해제', tone: 'accent' },
  { user: 'server', text: 'broadcast → room:lobby', tone: 'info' },
  { user: 'jun', text: '👋 joined', tone: 'success' },
]

const SEED_MESSAGES: WireMessage[] = [
  { id: -2, user: 'mina', text: 'doc:design 잠금 해제', tone: 'accent' },
  { id: -1, user: 'server', text: 'broadcast → room:lobby', tone: 'info' },
  { id: 0, user: 'jun', text: '👋 joined', tone: 'success' },
]

const PEERS = ['K', 'N', 'M', 'J', 'A', 'S'] as const
const MAX_ROWS = 4

const TONE_DOT: Record<WireMessage['tone'], string> = {
  accent: 'bg-accent',
  success: 'bg-success',
  info: 'bg-info',
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

export function LiveWire({ className }: { className?: string }) {
  const reduced = usePrefersReducedMotion()
  const [messages, setMessages] = useState<WireMessage[]>(SEED_MESSAGES)
  const [online, setOnline] = useState(18)
  const [peerCount, setPeerCount] = useState(4)
  const [, ping] = useReducer((n: number) => n + 1, 0)
  const stepRef = useRef(0)

  useEffect(() => {
    if (reduced) return
    const tick = window.setInterval(() => {
      const next = SCRIPT[stepRef.current % SCRIPT.length] ?? SCRIPT[0]
      stepRef.current += 1
      setMessages((prev) => {
        const appended: WireMessage[] = [...prev, { ...next, id: stepRef.current }]
        return appended.slice(-MAX_ROWS)
      })
      // presence 가 자연스럽게 출렁이도록.
      setOnline((o) => Math.max(11, Math.min(27, o + (Math.random() > 0.5 ? 1 : -1))))
      setPeerCount((c) => (c >= PEERS.length ? 3 : c + 1))
      ping()
    }, 2200)
    return () => window.clearInterval(tick)
  }, [reduced])

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border-strong/70 bg-surface shadow-lg',
        className
      )}
    >
      {/* 콘솔 헤더 — 채널 + 연결 상태(LIVE 펄스) */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-accent-strong" aria-hidden />
          <code className="font-mono text-[0.8125rem] font-semibold text-text">room:lobby</code>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-success">
          <span className="relative inline-flex size-1.5">
            <span className="absolute inline-flex size-full animate-[pulse-ring_1.8s_ease-out_infinite] rounded-full bg-current opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
          </span>
          LIVE
        </span>
      </div>

      {/* presence 행 — 합류하는 아바타 + 접속 수 */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center -space-x-1.5" aria-hidden>
          {PEERS.slice(0, peerCount).map((p, i) => (
            <span
              key={p}
              className="grid size-6 place-items-center rounded-full border-2 border-surface bg-accent-soft font-mono text-[0.625rem] font-bold text-accent-fg [animation:join-pop_0.5s_var(--ease-out-expo)_both]"
              style={{ zIndex: peerCount - i }}
            >
              {p}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-text-muted tabular-nums">
          <Users className="size-3.5 text-text-subtle" aria-hidden />
          {online}명 접속
        </span>
      </div>

      {/* 메시지 스트림 — 도착하는 이벤트 */}
      <ul className="flex min-h-[8.5rem] flex-col justify-end gap-1.5 px-4 py-3" aria-hidden>
        {messages.map((m) => (
          <li
            key={m.id}
            className="flex items-center gap-2 [animation:rise-in_0.45s_var(--ease-out-quint)_both]"
          >
            <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[m.tone])} />
            <code className="shrink-0 font-mono text-[0.6875rem] font-semibold text-text-subtle">
              {m.user}
            </code>
            <span className="truncate text-[0.8125rem] text-text-muted">{m.text}</span>
          </li>
        ))}
      </ul>

      {/* 푸터 — 서버 publish 한 줄(흐르는 캐럿) */}
      <div className="flex items-center gap-2 border-t border-border bg-surface-2/40 px-4 py-2.5">
        <Send className="size-3.5 shrink-0 text-accent-strong" aria-hidden />
        <code className="truncate font-mono text-[0.6875rem] text-text-muted">
          pub.publish('room:lobby', 'message', …)
        </code>
        <span
          className="ml-auto inline-block h-3.5 w-1.5 shrink-0 bg-accent [animation:caret-blink_1.1s_step-end_infinite]"
          aria-hidden
        />
      </div>

      {/* 스크린리더용 의미 보강(시각 데모는 aria-hidden). */}
      <p className="sr-only">
        라이브 데모: 채널 room:lobby 에 {online}명이 접속해 있고, 서버가 secret 키로 발행한 메시지가
        구독자에게 실시간으로 도착합니다.
      </p>
    </div>
  )
}
