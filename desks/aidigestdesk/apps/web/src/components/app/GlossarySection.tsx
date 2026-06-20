import {
  getGlossarySearchText,
  getGlossaryStats,
  glossaryCategories,
  glossaryTerms,
  type GlossaryCategory,
  type GlossaryTerm,
} from '@aidigestdesk/content'
import { BookA, Hash } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  Chip,
  EmptyState,
  ResultSummary,
  SearchField,
  SectionHeader,
  SegmentBar,
} from '@/components/app/CommonUi'

type CategoryFilter = GlossaryCategory | 'all'

/** id로 용어를 빠르게 찾기 위한 룩업. related 칩 라벨에 사용. */
const termById = new Map<string, GlossaryTerm>(glossaryTerms.map((term) => [term.id, term]))

const categoryItems: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '전체' },
  ...glossaryCategories.map((category) => ({ id: category, label: category })),
]

export function GlossarySection() {
  const stats = useMemo(() => getGlossaryStats(), [])
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [search, setSearch] = useState('')

  const trimmedSearch = search.trim().toLowerCase()
  const isDefault = category === 'all' && trimmedSearch === ''

  const filtered = useMemo(() => {
    return glossaryTerms.filter((term) => {
      if (category !== 'all' && term.category !== category) return false
      if (trimmedSearch && !getGlossarySearchText(term).toLowerCase().includes(trimmedSearch)) {
        return false
      }
      return true
    })
  }, [category, trimmedSearch])

  const resetFilters = () => {
    setCategory('all')
    setSearch('')
  }

  return (
    <section id="glossary" className="space-y-4">
      <SectionHeader
        icon={BookA}
        title="AI/LLM 용어 사전"
        description="상용 LLM·에이전트를 쓰며 자주 마주치는 영어 용어를 한국어 정의·관련어와 함께 카테고리로 정리했습니다. 검색과 분류로 빠르게 찾아보세요."
        badge={<Chip tone="blue">{stats.total}개 용어</Chip>}
      />

      <div className="space-y-3">
        <SegmentBar
          label="카테고리"
          items={categoryItems}
          value={category}
          onChange={setCategory}
        />
        <SearchField
          label="검색"
          value={search}
          onChange={setSearch}
          placeholder="용어, 한글 표기, 정의로 검색"
        />
        <ResultSummary
          shown={filtered.length}
          total={stats.total}
          unit="개"
          onReset={resetFilters}
          resetDisabled={isDefault}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="일치하는 용어가 없습니다"
          body="검색어나 카테고리를 바꾸거나 필터를 초기화해 보세요."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((term) => {
            const relatedTerms = term.related
              .map((id) => termById.get(id))
              .filter((related): related is GlossaryTerm => related !== undefined)

            return (
              <article key={term.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <h3 className="text-base font-bold text-text">{term.term}</h3>
                  <span className="text-sm text-text-muted">{term.koName}</span>
                  <span className="ml-auto">
                    <Chip tone="neutral" icon={Hash}>
                      {term.category}
                    </Chip>
                  </span>
                </div>

                <p className="mt-2 text-sm leading-6 text-text-muted">{term.definition}</p>

                {term.note ? (
                  <p className="mt-2 rounded bg-surface-2 px-2 py-1 text-xs leading-5 text-text-subtle">
                    {term.note}
                  </p>
                ) : null}

                {relatedTerms.length > 0 ? (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.6875rem] font-semibold text-text-subtle">관련어</span>
                    {relatedTerms.map((related) => (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => setSearch(related.term)}
                        className="inline-flex items-center rounded-md border border-border bg-bg px-2 py-0.5 text-[0.6875rem] font-semibold text-text-subtle transition hover:border-border-strong hover:text-text"
                      >
                        {related.koName}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
