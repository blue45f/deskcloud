import {
  getDomainFromUrl,
  getTranslatedArticleSearchText,
  getTranslatedNewsStats,
  newsRegions,
  translatedArticles,
  type NewsRegion,
  type ProviderId,
} from '@aidigestdesk/content'
import { CheckCircle2, ExternalLink, Languages } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  BrandMark,
  Chip,
  EmptyState,
  ResultSummary,
  SearchField,
  SectionHeader,
  SegmentBar,
  SortSelect,
} from '@/components/app/CommonUi'

type RegionFilter = NewsRegion | 'all'
type SortKey = 'published-desc' | 'published-asc' | 'publisher-asc'

const regionItems: Array<{ id: RegionFilter; label: string }> = [
  { id: 'all', label: '전체' },
  ...newsRegions.map((region) => ({ id: region, label: region })),
]

const sortOptions: Array<{ value: SortKey; label: string }> = [
  { value: 'published-desc', label: '최신순' },
  { value: 'published-asc', label: '오래된순' },
  { value: 'publisher-asc', label: '발행처 A→Z' },
]

const DEFAULT_SORT: SortKey = 'published-desc'

const stats = getTranslatedNewsStats()

const PROVIDER_IDS: ReadonlySet<string> = new Set<ProviderId>([
  'openai',
  'anthropic',
  'google',
  'xai',
  'manus',
  'kimi',
  'deepseek',
  'qwen',
  'mistral',
  'cursor',
])

/** providerIds에 정확히 하나의 유효한 ProviderId가 있을 때만 브랜드 아이콘에 사용한다. */
function singleProviderId(providerIds: ProviderId[] | undefined): ProviderId | undefined {
  const candidate = providerIds?.length === 1 ? providerIds[0] : undefined
  return candidate && PROVIDER_IDS.has(candidate) ? candidate : undefined
}

export function TranslatedNewsSection() {
  const [region, setRegion] = useState<RegionFilter>('all')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT)

  const filteredArticles = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR')

    const matched = translatedArticles.filter((article) => {
      const matchesRegion = region === 'all' || article.region === region
      const matchesQuery =
        !normalizedQuery ||
        getTranslatedArticleSearchText(article).toLocaleLowerCase('ko-KR').includes(normalizedQuery)
      return matchesRegion && matchesQuery
    })

    return matched.toSorted((left, right) => {
      switch (sortKey) {
        case 'published-asc':
          return left.publishedAt.localeCompare(right.publishedAt)
        case 'publisher-asc':
          return left.publisher.localeCompare(right.publisher)
        case 'published-desc':
        default:
          return right.publishedAt.localeCompare(left.publishedAt)
      }
    })
  }, [region, query, sortKey])

  const resetFilters = () => {
    setRegion('all')
    setQuery('')
    setSortKey(DEFAULT_SORT)
  }

  const isResetDisabled = region === 'all' && query.trim() === '' && sortKey === DEFAULT_SORT

  return (
    <section id="translated" className="space-y-4">
      <SectionHeader
        icon={Languages}
        title="해외 소식 · 번역"
        description="해외 공식 블로그·매체의 주요 AI 소식을 직접 번역·요약한 큐레이션입니다. 실시간 자동 번역이 아니며, 각 항목에 원문 출처와 정리 시점을 함께 표기합니다."
        badge={
          <Chip tone="amber">
            {stats.total}건 · {stats.regions}개 지역
          </Chip>
        }
      />

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1.6fr_1.4fr_1fr_1.2fr]">
        <SegmentBar label="지역" items={regionItems} value={region} onChange={setRegion} />
        <SearchField
          label="제목/요약/태그 검색"
          value={query}
          onChange={setQuery}
          placeholder="OpenAI, 규제, 비용, 오프피크"
        />
        <SortSelect value={sortKey} onChange={setSortKey} options={sortOptions} />
        <ResultSummary
          shown={filteredArticles.length}
          total={translatedArticles.length}
          unit="건"
          onReset={resetFilters}
          resetDisabled={isResetDisabled}
        />
      </div>

      {filteredArticles.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredArticles.map((article) => {
            const providerId = singleProviderId(article.providerIds)
            const keyPoints = article.keyPoints.slice(0, 3)

            return (
              <article key={article.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <BrandMark
                      providerId={providerId}
                      domain={providerId ? null : getDomainFromUrl(article.sourceUrl)}
                      label={article.publisher}
                      size="sm"
                    />
                    <Chip tone="blue">{article.region}</Chip>
                  </div>
                  <time className="shrink-0 text-xs font-medium text-text-subtle">
                    {article.publishedAt}
                  </time>
                </div>

                <h3 className="mt-3 text-sm font-bold text-text">{article.koTitle}</h3>
                <p className="mt-1 text-xs text-text-subtle">
                  원문: {article.originalTitle} · {article.publisher} ({article.originalLanguage})
                </p>

                <p className="mt-2 text-sm leading-6 text-text-muted">{article.koSummary}</p>

                {keyPoints.length ? (
                  <ul className="mt-3 space-y-1.5">
                    {keyPoints.map((point) => (
                      <li key={point} className="flex gap-2 text-xs leading-5 text-text-muted">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-accent" aria-hidden />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                {article.koreanAngle ? (
                  <p className="mt-3 rounded border border-accent/20 bg-accent/5 px-2 py-1 text-xs leading-5 text-text-muted">
                    <span className="font-semibold text-accent">국내 관점</span> {article.koreanAngle}
                  </p>
                ) : null}

                {article.tags.length ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {article.tags.map((tag) => (
                      <Chip key={tag}>{tag}</Chip>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <span className="text-[0.6875rem] text-text-subtle">{article.translatedAt} 정리</span>
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:underline"
                  >
                    원문 보기
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 해외 소식이 없습니다"
          body="지역을 전체로 바꾸거나 검색어를 줄여 다시 시도하세요."
        />
      )}
    </section>
  )
}
