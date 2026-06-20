import { Check, CheckCheck } from 'lucide-react'

import { cn } from '@/utils/cn'

/**
 * 히어로 제품 비주얼 — ChatDesk 가 임베드하는 실시간 대화 미리보기.
 *
 * 콜드한 색 블록 대신 제품 자체(1:1 DM 스레드)를 보여 준다: presence 점·타이핑 인디케이터·
 * 읽음 리시트 등 카피에서 약속한 실시간 기능이 그대로 눈에 들어온다. 순수 표현용 마크업이라
 * `aria-hidden`(스크린리더는 옆 카피로 충분). 모션은 reduced-motion 에서 자동 정지된다.
 */
export function ChatPreview({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-float relative w-full max-w-sm overflow-hidden rounded-2xl border border-border-strong/70 bg-surface shadow-lg',
        className
      )}
    >
      {/* 윈도우 헤더 — 상대 아바타 · 이름 · 온라인 점 */}
      <div className="flex items-center gap-3 border-b border-border bg-surface-2/70 px-4 py-3">
        <span className="relative grid size-9 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-fg">
          미
          <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-surface bg-success" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-text">미나 · 디자인팀</p>
          <p className="flex items-center gap-1 text-[0.7rem] text-success">
            <span className="size-1.5 rounded-full bg-current" />
            온라인
          </p>
        </div>
        <span className="ml-auto rounded-full border border-border bg-surface px-2 py-0.5 text-[0.65rem] font-medium text-text-subtle">
          1:1 DM
        </span>
      </div>

      {/* 메시지 스트림 */}
      <div className="space-y-3 px-4 py-5">
        <Incoming delay={0}>안녕하세요! 위젯 임베드 막 끝냈어요 🎉</Incoming>
        <Outgoing delay={140} read>
          오 빠르네요. 타이핑·읽음까지 다 실시간으로 떠요?
        </Outgoing>
        <Incoming delay={300}>네, 스크립트 한 줄이면 끝이에요</Incoming>

        {/* 타이핑 인디케이터 — 살아있는 느낌의 핵심 */}
        <div className="flex items-center gap-1.5">
          <span className="rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5">
            <span className="flex gap-1">
              <Dot index={0} />
              <Dot index={1} />
              <Dot index={2} />
            </span>
          </span>
        </div>
      </div>

      {/* 입력 바 (장식) */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <span className="flex-1 rounded-full bg-surface-2 px-3.5 py-2 text-[0.78rem] text-text-subtle">
          메시지 입력…
        </span>
        <span className="grid size-8 place-items-center rounded-full bg-ink text-ink-fg">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" aria-hidden>
            <path
              d="m22 2-7 20-4-9-9-4Z"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </div>
  )
}

function Dot({ index }: { index: number }) {
  return (
    <span
      className="typing-dot size-1.5 rounded-full bg-text-subtle"
      style={{ animationDelay: `${index * 0.18}s` }}
    />
  )
}

function Incoming({ children, delay }: { children: string; delay: number }) {
  return (
    <div className="flex justify-start">
      <p
        className="animate-bubble max-w-[80%] rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2.5 text-[0.82rem] leading-snug text-text"
        style={{ animationDelay: `${delay}ms` }}
      >
        {children}
      </p>
    </div>
  )
}

function Outgoing({ children, delay, read }: { children: string; delay: number; read?: boolean }) {
  return (
    <div className="flex flex-col items-end">
      <p
        className="animate-bubble max-w-[80%] rounded-2xl rounded-br-md bg-accent px-3.5 py-2.5 text-[0.82rem] leading-snug text-accent-fg"
        style={{ animationDelay: `${delay}ms` }}
      >
        {children}
      </p>
      <span className="mt-1 flex items-center gap-0.5 pr-1 text-[0.62rem] text-text-subtle">
        오후 2:14
        {read ? (
          <CheckCheck className="size-3 text-info" />
        ) : (
          <Check className="size-3 text-text-subtle" />
        )}
      </span>
    </div>
  )
}
