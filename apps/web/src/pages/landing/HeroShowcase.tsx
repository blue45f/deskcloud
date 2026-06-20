import { BadgeCheck, MessageSquareQuote, Sparkles, Star } from 'lucide-react'
import { type CSSProperties } from 'react'

import { SHOWCASE_DISTRIBUTION } from './showcase'

import { Stars } from '@/components/feature/Stars'
import { cn } from '@/utils/cn'

const ROWS = [5, 4, 3, 2, 1] as const

/**
 * 히어로 우측 장식 — 떠 있는 "별점 스냅샷" 카드 + 위성 칩들.
 * 실제 ReviewStars/ReviewList 위젯의 시각 언어(평균 별 + 분포 막대)를 미리보기처럼 보여 준다.
 * 순수 장식이므로 aria-hidden(스크린리더는 본문 카피로 충분).
 */
export function HeroShowcase({ className }: { className?: string }) {
  return (
    <div className={cn('relative isolate', className)} aria-hidden>
      {/* 메인 스냅샷 카드 */}
      <div
        className={cn(
          'animate-rise-pop relative z-10 rounded-2xl border border-border bg-surface/90 p-5 shadow-lg backdrop-blur',
          'float-slow'
        )}
        style={{ animationDelay: '240ms' } as CSSProperties}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-fg shadow-xs">
              <Star className="size-4 fill-current" />
            </span>
            <div className="leading-tight">
              <p className="text-[0.8125rem] font-semibold text-text">Pro 플랜</p>
              <p className="text-xs text-text-subtle">subject · pro-plan</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl leading-none font-bold tracking-tight tabular-nums text-text">
              4.9
            </p>
            <Stars value={5} size="sm" className="mt-1 justify-end" />
          </div>
        </div>

        {/* 분포 막대 — 진입 시 width 가 0 → 목표로 자라난다(키프레임 인라인). */}
        <div className="mt-4 space-y-1.5">
          {ROWS.map((n, i) => {
            const pct = SHOWCASE_DISTRIBUTION[n]
            return (
              <div key={n} className="flex items-center gap-2">
                <span className="w-3 text-right text-[0.6875rem] font-medium text-text-subtle tabular-nums">
                  {n}
                </span>
                <Star className="size-3 fill-warning text-warning" />
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent to-warning [animation:rise-in_700ms_cubic-bezier(0.22,1,0.36,1)_both]"
                    style={{ width: `${pct}%`, animationDelay: `${420 + i * 90}ms` }}
                  />
                </span>
                <span className="w-7 text-right text-[0.6875rem] text-text-subtle tabular-nums">
                  {pct}%
                </span>
              </div>
            )
          })}
        </div>

        <p className="mt-4 flex items-center gap-1.5 border-t border-border pt-3 text-xs text-text-muted">
          <BadgeCheck className="size-3.5 text-success" />
          승인된 리뷰 1,284건 집계
        </p>
      </div>

      {/* 위성 칩 — 신규 리뷰 알림 */}
      <div
        className="animate-rise-pop float-slow absolute -top-5 -right-3 z-20 flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 shadow-md"
        style={{ animationDelay: '520ms', animationDuration: '8s' } as CSSProperties}
      >
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/70" />
          <span className="relative inline-flex size-2 rounded-full bg-success" />
        </span>
        <span className="text-xs font-medium text-text">새 리뷰 +1</span>
      </div>

      {/* 위성 칩 — 후기 인용 */}
      <div
        className="animate-rise-pop float-slow absolute -bottom-6 -left-4 z-0 flex max-w-[14rem] items-start gap-2 rounded-xl border border-border bg-surface/95 px-3 py-2.5 shadow-md backdrop-blur"
        style={{ animationDelay: '660ms', animationDuration: '9s' } as CSSProperties}
      >
        <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-accent-strong" />
        <p className="text-[0.75rem] leading-snug text-pretty text-text-muted">
          “한 줄 붙였더니 별점 배지가 바로 떴어요.”
        </p>
      </div>

      {/* 트윙클 스파클 */}
      <Sparkles className="absolute top-1/2 -right-6 z-20 size-5 text-warning [animation:twinkle_3.4s_ease-in-out_infinite]" />
      <Sparkles className="absolute -bottom-2 right-10 z-20 size-3.5 text-accent [animation:twinkle_4.2s_ease-in-out_0.6s_infinite]" />
    </div>
  )
}
