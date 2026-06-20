import { Bell, Check, Mail, Package, Smartphone, Sparkles } from 'lucide-react'
import { useMemo, useState, type ComponentType } from 'react'

import { cn } from '@/utils/cn'

type ChannelId = 'in_app' | 'email' | 'web_push'

const CHANNELS: {
  id: ChannelId
  label: string
  icon: ComponentType<{ className?: string }>
  locked?: boolean
}[] = [
  { id: 'in_app', label: 'in-app', icon: Bell, locked: true },
  { id: 'email', label: 'email', icon: Mail },
  { id: 'web_push', label: 'web-push', icon: Smartphone },
]

type InboxItem = {
  id: string
  icon: ComponentType<{ className?: string }>
  title: string
  body: string
  time: string
  unread?: boolean
}

const ITEMS: InboxItem[] = [
  {
    id: 'shipped',
    icon: Package,
    title: '주문이 발송되었어요',
    body: '지은님, A-1024 · CJ대한통운',
    time: '방금',
    unread: true,
  },
  {
    id: 'welcome',
    icon: Sparkles,
    title: '환영합니다 🎉',
    body: '첫 알림을 보내 볼까요?',
    time: '2분 전',
    unread: true,
  },
  {
    id: 'digest',
    icon: Mail,
    title: '주간 요약 리포트',
    body: '이번 주 발송 1,284건',
    time: '어제',
  },
]

/**
 * 히어로 우측 라이브 제품 비네트 — 실제 인박스 벨/카드 UI 를 작게 재현한다.
 * 채널 칩(in-app 고정, email·web-push 토글)을 켜고 끄면 미읽음 카운트가 즉시 반응해,
 * 랜딩에서 바로 "선호(type×channel) 게이팅" 개념을 만질 수 있게 한다. 순수 로컬 상태(네트워크 0).
 */
export function HeroInboxDemo() {
  const [active, setActive] = useState<Record<ChannelId, boolean>>({
    in_app: true,
    email: true,
    web_push: false,
  })

  const toggle = (id: ChannelId): void => {
    setActive((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // in-app 은 항상 인박스에 쌓이므로 미읽음은 그대로. 추가 채널 on 개수를 "배달 경로"로 표현.
  const unread = useMemo(() => ITEMS.filter((i) => i.unread).length, [])
  const extraChannels = (active.email ? 1 : 0) + (active.web_push ? 1 : 0)

  return (
    <div className="relative" aria-hidden>
      {/* 떠다니는 보조 칩 — 발송 경로 라벨. */}
      <div className="pointer-events-none absolute -top-5 -left-6 hidden rounded-full border border-border bg-surface/90 px-3 py-1.5 text-xs font-medium text-text-muted shadow-md backdrop-blur sm:flex sm:items-center sm:gap-1.5 [animation:float-soft_6s_ease-in-out_infinite]">
        <span className="size-1.5 rounded-full bg-success [animation:badge-pop_400ms_var(--ease-out-quint)_both]" />
        notify() 호출됨
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
        {/* 앱 헤더 모사 */}
        <div className="flex items-center justify-between border-b border-border bg-surface-2/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-danger/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-success/70" />
            <span className="ml-2 font-mono text-[0.6875rem] text-text-subtle">
              app.example.com
            </span>
          </div>
          {/* 벨 + 미읽음 배지 */}
          <span className="relative grid size-8 place-items-center rounded-md text-text-muted">
            <Bell className="size-[1.15rem] origin-top [animation:bell-swing_5s_ease-in-out_1.2s_infinite]" />
            {unread > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 grid min-w-[1.05rem] place-items-center rounded-full bg-accent-strong px-1 text-[0.625rem] font-bold text-white [animation:badge-pop_420ms_var(--ease-out-quint)_300ms_both]">
                {unread}
              </span>
            ) : null}
          </span>
        </div>

        {/* 인박스 카드 스택 */}
        <ul className="space-y-2 p-3">
          {ITEMS.map((item, i) => (
            <li
              key={item.id}
              className="anim-rise flex items-start gap-3 rounded-xl border border-border/70 bg-bg/60 px-3 py-2.5"
              style={{ '--i': i + 2 } as React.CSSProperties}
            >
              <span
                className={cn(
                  'mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg',
                  item.unread ? 'bg-accent-soft text-accent-fg' : 'bg-surface-2 text-text-subtle'
                )}
              >
                <item.icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[0.8125rem] font-semibold text-text">{item.title}</p>
                  <span className="shrink-0 text-[0.6875rem] text-text-subtle">{item.time}</span>
                </div>
                <p className="truncate text-xs text-text-muted">{item.body}</p>
              </div>
              {item.unread ? (
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent-strong" />
              ) : (
                <Check className="mt-1.5 size-3.5 shrink-0 text-text-subtle" />
              )}
            </li>
          ))}
        </ul>

        {/* 채널 토글 바 — 선호 게이팅을 손으로 만져 보는 인터랙션. */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-2/40 px-3 py-2.5">
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((ch) => {
              const on = active[ch.id]
              return (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => !ch.locked && toggle(ch.id)}
                  disabled={ch.locked}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.6875rem] font-medium transition-all duration-150',
                    on
                      ? 'border-transparent bg-accent-soft text-accent-fg'
                      : 'border-border bg-surface text-text-subtle hover:border-border-strong',
                    ch.locked ? 'cursor-default opacity-100' : 'cursor-pointer active:scale-95'
                  )}
                  title={ch.locked ? 'in-app 은 항상 켜져 있습니다' : `${ch.label} 채널 토글`}
                >
                  <ch.icon className="size-3" />
                  {ch.label}
                  {ch.locked ? <span className="text-[0.5625rem] opacity-70">고정</span> : null}
                </button>
              )
            })}
          </div>
          <span className="shrink-0 font-mono text-[0.625rem] text-text-subtle">
            +{extraChannels} 채널
          </span>
        </div>
      </div>
    </div>
  )
}
