import { CornerDownLeft, FileText, Hash, Search } from 'lucide-react'
import { useEffect, useReducer, useState } from 'react'

import { cn } from '@/utils/cn'

/**
 * 히어로 포컬 비주얼 — 살아있는 ⌘K 팔레트 목업.
 *
 * 실제 위젯(@searchdesk/widget)이 아니라 "보여주기용" 정적 데모다(네트워크 0).
 * 예시 쿼리를 한 글자씩 타이핑 → 매칭 결과를 스태거로 드러냄 → 잠시 멈춤 → 다음 쿼리로 순환.
 * `prefers-reduced-motion` 이면 첫 쿼리/결과를 정적으로 보여주고 타이핑을 멈춘다(접근성·CLS 0).
 */

type Hit = { icon: typeof FileText; title: string; meta: string; tag?: string }

const SCENES: { query: string; hits: Hit[] }[] = [
  {
    query: 'command palette',
    hits: [
      { icon: Hash, title: '⌘K 커맨드 팔레트 임베드', meta: 'docs · embed', tag: 'guide' },
      { icon: FileText, title: '키보드 내비게이션 & 포커스 트랩', meta: 'docs · a11y' },
      { icon: FileText, title: '인라인 SearchBox vs 팔레트', meta: 'docs · widget' },
    ],
  },
  {
    query: 'ranking',
    hits: [
      { icon: Hash, title: 'title 매치가 body 보다 무겁게', meta: 'docs · ranking', tag: 'core' },
      { icon: FileText, title: '토큰 커버리지 · 근접 · 구문 보너스', meta: 'docs · ranking' },
      { icon: FileText, title: '<mark> 하이라이트 스니펫', meta: 'docs · highlight' },
    ],
  },
  {
    query: 'cors origin',
    hits: [
      { icon: Hash, title: '테넌트별 CORS 허용목록', meta: 'docs · security', tag: 'pk_' },
      { icon: FileText, title: 'publishable 키로 브라우저 검색', meta: 'docs · keys' },
      { icon: FileText, title: 'Origin 검사 & PublishableKeyGuard', meta: 'docs · guard' },
    ],
  },
]

// SCENES 는 항상 비어있지 않은 리터럴 — 첫 씬을 안전 폴백으로 고정(noUncheckedIndexedAccess 대응).
const FIRST_SCENE = SCENES[0] as (typeof SCENES)[number]

const prefersReduced = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

export function HeroSearchMock({ className }: { className?: string }) {
  // 모션 감소 선호 — 마운트 시 1회 결정(렌더 중 ref 접근 회피).
  const [reduced] = useState(prefersReduced)
  const [scene, setScene] = useState(0)
  const [typed, setTyped] = useState(reduced ? FIRST_SCENE.query : '')
  // 결과 표시 여부 — 타이핑 완료 후 true.
  const [showHits, setShowHits] = useState(reduced)
  // 재마운트 없이 hits 의 스태거 애니메이션을 다시 트리거하기 위한 키.
  const [, bump] = useReducer((n: number) => n + 1, 0)

  const current = SCENES[scene] ?? FIRST_SCENE

  useEffect(() => {
    if (reduced) return
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    const at = (ms: number, fn: () => void) => {
      const t = setTimeout(() => {
        if (!cancelled) fn()
      }, ms)
      timers.push(t)
    }

    const q = current.query

    // 씬 시작 리셋 — 동기 setState(캐스케이드 렌더) 대신 0ms 타이머로 디퍼.
    at(0, () => {
      setShowHits(false)
      setTyped('')
      bump()
    })

    // 글자별 타이핑.
    const perChar = 58
    for (let i = 1; i <= q.length; i += 1) {
      at(i * perChar, () => setTyped(q.slice(0, i)))
    }
    const typedDone = q.length * perChar
    at(typedDone + 220, () => setShowHits(true))
    // 결과를 잠시 보여준 뒤 다음 씬으로.
    at(typedDone + 2600, () => setScene((s) => (s + 1) % SCENES.length))

    return () => {
      cancelled = true
      timers.forEach(clearTimeout)
    }
  }, [scene, current.query, reduced])

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-xl border border-border-strong/70 bg-surface/90 shadow-lg backdrop-blur',
        className
      )}
      aria-hidden
    >
      {/* 상단 윈도우 바 */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-danger/70" />
        <span className="size-2.5 rounded-full bg-warning/70" />
        <span className="size-2.5 rounded-full bg-success/70" />
        <span className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[0.7rem] text-text-subtle">
          search.yourapp.com
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-bg px-1.5 py-0.5 font-mono text-[0.7rem] text-text-muted">
          ⌘K
        </span>
      </div>

      {/* 검색 입력 줄 */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <Search className="size-4 shrink-0 text-accent-strong" />
        <span className="font-mono text-[0.9rem] text-text">
          {typed}
          {!reduced && (
            <span
              className="ml-px inline-block h-[1.05em] w-[2px] -translate-y-px bg-accent-strong align-middle"
              style={{ animation: 'caret-blink 1.05s steps(1) infinite' }}
            />
          )}
        </span>
      </div>

      {/* 결과 리스트 */}
      <ul className="min-h-[10.5rem] p-2">
        {current.hits.map((hit, i) => (
          <li
            key={`${scene}-${hit.title}`}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
              i === 0 && 'bg-accent-soft/60'
            )}
            style={
              showHits
                ? {
                    animation: `rise-in 460ms cubic-bezier(0.22,1,0.36,1) both`,
                    animationDelay: `${i * 90}ms`,
                  }
                : { opacity: 0 }
            }
          >
            <span
              className={cn(
                'grid size-7 shrink-0 place-items-center rounded-md',
                i === 0 ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-text-muted'
              )}
            >
              <hit.icon className="size-3.5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.82rem] font-medium text-text">
                {hit.title}
              </span>
              <span className="block truncate font-mono text-[0.68rem] text-text-subtle">
                {hit.meta}
              </span>
            </span>
            {hit.tag ? (
              <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[0.62rem] text-text-muted">
                {hit.tag}
              </span>
            ) : null}
            {i === 0 ? <CornerDownLeft className="size-3.5 shrink-0 text-accent-strong" /> : null}
          </li>
        ))}
      </ul>

      {/* 하단 힌트 바 */}
      <div className="flex items-center gap-3 border-t border-border px-4 py-2 font-mono text-[0.66rem] text-text-subtle">
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-bg px-1">↑</kbd>
          <kbd className="rounded border border-border bg-bg px-1">↓</kbd> 이동
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-bg px-1">↵</kbd> 열기
        </span>
        <span className="inline-flex items-center gap-1">
          <kbd className="rounded border border-border bg-bg px-1">esc</kbd> 닫기
        </span>
        <span className="ml-auto text-accent-strong">SearchDesk</span>
      </div>
    </div>
  )
}
