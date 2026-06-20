import { Star, TrendingUp } from 'lucide-react'

import { cn } from '@/utils/cn'

/* 분포 미리보기 행 — 채움 바가 한 번 쓸어 들어온다(grow-x). */
const DISTRIBUTION = [
  { label: '팀/업무', pct: 50, delay: 360 },
  { label: '개인', pct: 35, delay: 460 },
  { label: '평가·테스트', pct: 15, delay: 560 },
] as const

/**
 * 히어로 우측 데코 — 실제 집계 화면의 축약 미리보기.
 * "큰 숫자 하나" 히어로-메트릭 클리셰가 아니라, 위젯이 모으는 결과(평점·NPS·분포)를
 * 작은 진짜 카드로 보여 준다. 부유 모션은 reduced-motion 에서 전역 규칙으로 멈춘다.
 * aria-hidden — 장식이며, 같은 정보는 본문 카피·기능 그리드가 텍스트로 전한다.
 */
export function HeroPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)} aria-hidden>
      {/* 메인 집계 카드 */}
      <div className="animate-in [--d:220ms] motion-safe:animate-[float-soft_7s_ease-in-out_infinite] rounded-2xl border border-border bg-surface/90 p-5 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-[0.8125rem] font-medium text-text-muted">
            데모 앱은 어떠셨나요?
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[0.6875rem] font-semibold text-success">
            <span className="size-1.5 rounded-full bg-current" />
            활성
          </span>
        </div>

        {/* 평균 별점 */}
        <div className="mt-4 flex items-end gap-3">
          <div className="text-4xl font-semibold tracking-tight text-text tabular-nums">4.38</div>
          <div className="mb-1 flex gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star
                key={i}
                className="size-4 fill-warning text-warning motion-safe:[animation:star-pop_500ms_var(--ease-out-quint)_both]"
                style={{ animationDelay: `${260 + i * 90}ms` }}
              />
            ))}
          </div>
        </div>
        <p className="mt-0.5 text-xs text-text-subtle">216개 응답 · 5점 만점</p>

        {/* 분포 미니바 */}
        <div className="mt-4 space-y-2.5">
          {DISTRIBUTION.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-[0.6875rem] text-text-subtle">
                <span>{row.label}</span>
                <span className="font-mono tabular-nums">{row.pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full origin-left rounded-full bg-accent motion-safe:[animation:grow-x_900ms_var(--ease-out-quint)_both]"
                  style={{ width: `${row.pct}%`, animationDelay: `${row.delay}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 떠 있는 NPS 칩 — 메인 카드와 살짝 다른 리듬으로 부유 */}
      <div className="animate-in [--d:520ms] motion-safe:animate-[float-soft_6s_ease-in-out_infinite_0.8s] absolute -top-5 -right-3 flex items-center gap-2 rounded-xl border border-border bg-ink px-3.5 py-2.5 text-ink-fg shadow-lg">
        <TrendingUp className="size-4 text-accent" />
        <div className="leading-tight">
          <div className="text-lg font-semibold tracking-tight tabular-nums">+62</div>
          <div className="text-[0.625rem] text-ink-fg/70">NPS 점수</div>
        </div>
      </div>
    </div>
  )
}
