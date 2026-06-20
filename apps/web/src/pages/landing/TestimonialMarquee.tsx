import { Quote } from 'lucide-react'

import { SHOWCASE_TESTIMONIALS, type ShowcaseTestimonial } from './showcase'

import { Stars } from '@/components/feature/Stars'
import { cn } from '@/utils/cn'

function initials(name: string): string {
  const trimmed = name.trim()
  // 한글은 첫 글자, 라틴은 앞 두 토큰 이니셜.
  if (/[가-힣]/.test(trimmed)) return trimmed.slice(0, 1)
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
}

function TestimonialCard({ t }: { t: ShowcaseTestimonial }) {
  return (
    <figure
      className={cn(
        'flex w-[19rem] shrink-0 flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm',
        'transition-[transform,box-shadow,border-color] duration-200',
        'hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md'
      )}
    >
      <div className="flex items-center justify-between">
        <Stars value={t.rating} size="sm" />
        <Quote className="size-4 text-accent/60" aria-hidden />
      </div>
      <blockquote className="text-[0.875rem] leading-relaxed text-pretty text-text">
        “{t.quote}”
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-2.5 pt-1">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.75rem] font-bold text-accent-fg"
          aria-hidden
        >
          {initials(t.author)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.8125rem] font-semibold text-text">
            {t.author}
          </span>
          <span className="block truncate text-xs text-text-subtle">{t.role}</span>
        </span>
      </figcaption>
    </figure>
  )
}

/**
 * 후기 월 마키 — 무한 가로 스크롤하는 사회적 증거 띠.
 * 트랙을 2벌 이어 붙여 seamless 루프를 만들고(translateX -50%), 호버·포커스 시 정지한다.
 * reduced-motion 에선 전역 규칙이 애니메이션을 무력화해 가로 스크롤 가능한 정적 행이 된다.
 *
 * `reverse` 로 두 번째 줄을 반대로 흘려 시선의 깊이감을 준다.
 */
export function TestimonialMarquee({
  reverse = false,
  durationMs = 46000,
  className,
}: {
  reverse?: boolean
  durationMs?: number
  className?: string
}) {
  // 끊김 없는 루프를 위해 동일 목록을 2벌 렌더(translateX -50% 가 정확히 한 벌 폭).
  const loop = [...SHOWCASE_TESTIMONIALS, ...SHOWCASE_TESTIMONIALS]
  return (
    <div
      className={cn(
        'marquee-group group relative overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className
      )}
      // 마키는 장식적 사회 증거 — 스크린리더에는 아래 정적 SR 목록만 노출.
      aria-hidden
    >
      <div
        className={cn(
          'marquee-track flex w-max gap-4 py-1',
          reverse && '[animation-direction:reverse]'
        )}
        style={{ ['--marquee-duration' as string]: `${durationMs}ms` }}
      >
        {loop.map((t, i) => (
          <TestimonialCard key={`${t.author}-${i}`} t={t} />
        ))}
      </div>
      {/* 좌우 페이드 마스크 — 띠가 자연스럽게 사라지도록. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-bg to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent"
        aria-hidden
      />
    </div>
  )
}
