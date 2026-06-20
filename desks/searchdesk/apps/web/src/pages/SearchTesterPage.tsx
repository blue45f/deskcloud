import { DEFAULT_INDEX, type SearchResponseDto } from '@searchdesk/shared'
import { Search, SearchX, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAuthStore } from '@/app/authStore'
import { FacetList } from '@/components/feature/FacetList'
import { EngineBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, Spinner } from '@/components/ui/feedback'
import { Input } from '@/components/ui/field'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { runSearch, useTenant } from '@/services/searchdesk'

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  (typeof window !== 'undefined' ? window.location.origin : '')

/** 하이라이트 HTML(<mark>)을 안전하게 렌더(서버가 이스케이프 후 mark 만 감쌈). */
function Highlight({ html, className }: { html: string; className?: string }) {
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export default function SearchTesterPage() {
  useDocumentTitle('검색 테스터')
  const creds = useAuthStore((s) => s.creds)
  const tenant = useTenant()

  const publishableKey = tenant.data?.publishableKey ?? creds.publishableKey

  const [query, setQuery] = useState('')
  const [index, setIndex] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [result, setResult] = useState<SearchResponseDto | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const doSearch = useCallback(
    (q: string, cat: string | null, tg: string[], idx: string) => {
      if (!publishableKey) {
        setPhase('error')
        setError('publishable 키를 찾을 수 없습니다. 설정에서 키 로테이션 후 다시 시도하세요.')
        return
      }
      abortRef.current?.abort()
      const trimmed = q.trim()
      if (trimmed.length === 0) {
        setPhase('idle')
        setResult(null)
        return
      }
      const ctrl = new AbortController()
      abortRef.current = ctrl
      setPhase('loading')
      setError(null)
      runSearch({
        publishableKey,
        endpoint: API_BASE,
        q: trimmed,
        index: idx.trim() || undefined,
        category: cat ?? undefined,
        tags: tg,
        limit: 20,
        signal: ctrl.signal,
      })
        .then((res) => {
          if (ctrl.signal.aborted) return
          setResult(res)
          setPhase('ready')
        })
        .catch((e: unknown) => {
          if (ctrl.signal.aborted) return
          setError(e instanceof Error ? e.message : '검색에 실패했습니다.')
          setPhase('error')
        })
    },
    [publishableKey]
  )

  // 디바운스 — query/filters 변경 시 자동 검색.
  useEffect(() => {
    const t = setTimeout(() => doSearch(query, category, tags, index), 200)
    return () => clearTimeout(t)
  }, [query, category, tags, index, doSearch])

  const toggleCategory = (v: string) => setCategory((c) => (c === v ? null : v))
  const toggleTag = (v: string) =>
    setTags((arr) => (arr.includes(v) ? arr.filter((t) => t !== v) : [...arr, v]))

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-text">검색 테스터</h1>
        <p className="mt-1 text-sm text-text-muted">
          publishable 키로 실제 검색 엔드포인트를 호출해 랭킹·하이라이트·패싯을 확인합니다.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="예: command palette, ranking, cors…"
            className="h-11 pl-9 text-base"
            aria-label="검색어"
            autoFocus
          />
        </div>
        <Input
          value={index}
          onChange={(e) => setIndex(e.target.value)}
          placeholder={`인덱스 (기본 ${DEFAULT_INDEX})`}
          className="h-11 font-mono"
          aria-label="인덱스"
        />
      </div>

      {!publishableKey ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={SearchX}
              title="publishable 키가 필요합니다"
              description="검색은 pk_ 키로 호출됩니다. 설정에서 키를 로테이션하면 pk_ 가 다시 표시됩니다."
              action={
                <Button asChild size="sm" variant="accent">
                  <Link to="/app/settings">설정으로</Link>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
          {/* 결과 */}
          <div className="min-w-0 space-y-3">
            {phase === 'ready' && result ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-subtle">
                <span>
                  <strong className="font-semibold text-text">
                    {result.total.toLocaleString()}
                  </strong>
                  건 매치
                </span>
                <span aria-hidden>·</span>
                <span>상위 {result.hits.length}건 표시</span>
                <span aria-hidden>·</span>
                <EngineBadge engine={result.engine} />
              </div>
            ) : null}

            {phase === 'idle' ? (
              <EmptyState
                icon={Sparkles}
                title="검색어를 입력하세요"
                description="입력하면 디바운스 후 자동으로 검색합니다. 좌측에서 카테고리·태그로 좁힐 수 있습니다."
              />
            ) : phase === 'loading' ? (
              <div className="grid place-items-center py-16">
                <Spinner className="size-6" />
              </div>
            ) : phase === 'error' ? (
              <EmptyState
                icon={SearchX}
                title="검색에 실패했습니다"
                description={error ?? '네트워크 상태를 확인해 주세요.'}
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => doSearch(query, category, tags, index)}
                  >
                    다시 시도
                  </Button>
                }
              />
            ) : result && result.hits.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="결과가 없습니다"
                description={`"${query.trim()}" 에 대한 결과를 찾지 못했습니다. 필터를 비우거나 다른 검색어를 시도하세요.`}
              />
            ) : (
              <ul className="space-y-2.5">
                {result?.hits.map((hit) => (
                  <li key={`${hit.index}:${hit.id}`}>
                    <Card className="transition-colors hover:border-border-strong">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Highlight
                              className="block truncate text-sm font-semibold text-text"
                              html={hit.titleHighlight}
                            />
                            {hit.snippet ? (
                              <Highlight
                                className="mt-1 line-clamp-2 block text-[0.8125rem] text-text-muted"
                                html={hit.snippet}
                              />
                            ) : null}
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-text-subtle">
                              <span className="font-mono">{hit.id}</span>
                              {hit.category ? (
                                <>
                                  <span aria-hidden>·</span>
                                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-fg">
                                    {hit.category}
                                  </span>
                                </>
                              ) : null}
                              {hit.tags.map((t) => (
                                <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </div>
                          <span className="shrink-0 rounded-md bg-surface-2 px-2 py-1 font-mono text-xs text-text-subtle tabular-nums">
                            {hit.score.toFixed(1)}
                          </span>
                        </div>
                        {hit.url ? (
                          <a
                            href={hit.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 block truncate font-mono text-xs text-accent-strong hover:text-accent"
                          >
                            {hit.url}
                          </a>
                        ) : null}
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 패싯 사이드바 */}
          <aside className="space-y-5">
            {(category || tags.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCategory(null)
                  setTags([])
                }}
              >
                필터 초기화
              </Button>
            )}
            <FacetList
              title="카테고리"
              mode="single"
              facets={result?.facets.category ?? []}
              selected={category ? [category] : []}
              onToggle={toggleCategory}
            />
            <FacetList
              title="태그"
              mode="multi"
              facets={result?.facets.tags ?? []}
              selected={tags}
              onToggle={toggleTag}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
