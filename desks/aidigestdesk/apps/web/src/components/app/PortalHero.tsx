import { getCatalogStats, SNAPSHOT_DATE } from '@aidigestdesk/content'
import { ArrowRight, BadgePercent, BookOpen, ShieldCheck, Sparkles, Table2 } from 'lucide-react'

import type { AppRoute } from '@/components/app/appRoutes'

import { CountUp } from '@/components/app/Motion'

const stats = getCatalogStats()

const signalStats: Array<{ label: string; value: number; suffix?: string }> = [
  { label: '제공사', value: stats.providers },
  { label: '업데이트', value: stats.updates },
  { label: '벤치마크', value: stats.benchmarkRows },
  { label: '출처', value: stats.sources },
]

/**
 * 포털 홈 대시보드 헤더. 마케팅 히어로가 아니라 "오늘 무엇이 바뀌었나"를
 * 한눈에 보여주는 작업 대시보드 머리글이다. 정체성(차분한 cool-250, teal 강조,
 * 그라데이션 텍스트·중첩 카드 금지)을 지키되, 절제된 광채·라이브 신호·카운트업으로
 * 첫 화면에 자신감과 생동감을 준다.
 */
export function PortalHero({ onNavigate }: { onNavigate: (route: AppRoute) => void }) {
  return (
    <section
      aria-labelledby="portal-hero-title"
      className="reveal is-revealed relative overflow-hidden rounded-lg border border-border bg-surface"
    >
      {/* 절제된 teal 광채 — 깊이를 주는 분위기 레이어. 텍스트 그라데이션 아님. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full opacity-70 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--color-accent), transparent 72%), transparent 70%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 left-1/3 size-72 rounded-full opacity-50 blur-3xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in oklch, var(--color-accent-2), transparent 80%), transparent 70%)',
        }}
      />

      <div className="relative grid gap-6 p-5 sm:p-7 xl:grid-cols-[1.5fr_1fr] xl:items-center">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-text-muted">
            <span className="live-dot" aria-hidden />
            실시간 큐레이션 · {SNAPSHOT_DATE} 스냅샷
          </p>
          <h1
            id="portal-hero-title"
            className="mt-3 text-3xl font-bold leading-tight tracking-tight text-text text-balance sm:text-[2.5rem]"
          >
            오늘의 AI 다이제스트
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-muted text-pretty sm:text-base">
            GPT, Claude, Gemini, Grok, Manus의 최신 업데이트·벤치마크·비용을 한국어로 정리했습니다.
            모든 항목은 날짜와 출처로 추적됩니다.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('models')}
              className="group/cta relative inline-flex h-11 items-center gap-2 overflow-hidden rounded-md border border-ink bg-ink px-5 text-sm font-semibold text-ink-fg transition-[transform,box-shadow] duration-200 ease-[var(--ease-out-quart)] hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-12px_color-mix(in_oklch,var(--color-accent),transparent_45%)] active:translate-y-0"
            >
              <Table2 className="size-4" aria-hidden />
              모델·벤치마크 비교
              <ArrowRight
                className="size-4 transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover/cta:translate-x-0.5"
                aria-hidden
              />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-bg px-4 text-sm font-semibold text-text-muted transition-colors duration-200 hover:border-border-strong hover:text-text"
            >
              <Sparkles className="size-4 text-accent" aria-hidden />
              처음이신가요? 소개·가이드
            </button>
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-xs text-text-subtle">
            <ShieldCheck className="size-3.5 text-accent" aria-hidden />
            공식 문서·벤치마크·출판·커뮤니티 출처를 분리해 표기합니다.
          </p>
        </div>

        {/* 신호 스트립 — 카탈로그 규모를 한눈에. 장식이 아니라 범위 신호. */}
        <dl className="grid grid-cols-2 gap-2.5">
          {signalStats.map((stat, index) => (
            <div
              key={stat.label}
              className="rounded-md border border-border bg-bg/80 p-3.5 backdrop-blur-sm"
            >
              <dt className="text-xs font-semibold text-text-subtle">{stat.label}</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-text">
                <CountUp
                  value={stat.value}
                  suffix={stat.suffix}
                  durationMs={900 + index * 120}
                />
              </dd>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onNavigate('deals')}
            className="group col-span-2 flex items-center justify-between gap-2 rounded-md border border-accent/25 bg-accent/5 px-3.5 py-2.5 text-left transition-colors duration-200 hover:bg-accent/10"
          >
            <span className="flex items-center gap-2 text-xs font-semibold text-accent">
              <BadgePercent className="size-4" aria-hidden />
              {stats.deals}건의 LLM 할인·혜택 추적 중
            </span>
            <ArrowRight
              className="size-4 text-accent transition-transform duration-200 ease-[var(--ease-out-quart)] group-hover:translate-x-0.5"
              aria-hidden
            />
          </button>
        </dl>
      </div>

      <div
        aria-hidden
        className="relative flex items-center gap-4 border-t border-border bg-bg/40 px-5 py-2.5 text-[0.6875rem] font-medium text-text-subtle sm:px-7"
      >
        <BookOpen className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">
          모델 {stats.providers}개사 · AI 도구 {stats.aiCodingTools} · 확장 {stats.extensions} ·
          강좌/자료 {stats.resources} · 일정 {stats.eventSchedules}
        </span>
      </div>
    </section>
  )
}
