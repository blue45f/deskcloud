import {
  getContentMetadataSearchText,
  getSourceMetadata,
  type SourceRef,
} from '@aidigestdesk/content'
import { ExternalLink, FileText } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  BrandMark,
  EmptyState,
  MetadataChips,
  ResultSummary,
  SearchField,
  SegmentBar,
  SectionHeader,
  Select,
  SortSelect,
  SourceKindBadge,
} from '@/components/app/CommonUi'
import { sourceKindFilters, sourceKindLabel, type SourceKindFilter } from '@/components/app/sourceLabels'

type SourceSortKey =
  | 'title-asc'
  | 'title-desc'
  | 'publisher-asc'
  | 'publisher-desc'
  | 'kind-asc'
  | 'lastChecked-desc'
  | 'lastChecked-asc'

const sortOptions: Array<{ value: SourceSortKey; label: string }> = [
  { value: 'title-asc', label: '제목 A→Z' },
  { value: 'title-desc', label: '제목 Z→A' },
  { value: 'publisher-asc', label: '발행처 A→Z' },
  { value: 'publisher-desc', label: '발행처 Z→A' },
  { value: 'kind-asc', label: '출처 성격순' },
  { value: 'lastChecked-desc', label: '확인일 최신순' },
  { value: 'lastChecked-asc', label: '확인일 오래된순' },
]

const limitOptions: Array<{ value: number; label: string }> = [
  { value: 0, label: '전체' },
  { value: 12, label: '12개' },
  { value: 24, label: '24개' },
  { value: 48, label: '48개' },
]

export function SourcesSection({ sourceItems }: { sourceItems: SourceRef[] }) {
  const [kind, setKind] = useState<SourceKindFilter>('all')
  const [publisherQuery, setPublisherQuery] = useState('')
  const [sortKey, setSortKey] = useState<SourceSortKey>('title-asc')
  const [sourceLimit, setSourceLimit] = useState(0)

  const filteredSources = useMemo(() => {
    const normalizedQuery = publisherQuery.trim().toLocaleLowerCase('ko-KR')

    const sorted = sourceItems.filter((source) => {
      const metadata = getSourceMetadata(source)
      const searchable = `${source.publisher} ${source.title} ${source.note} ${source.kind} ${getContentMetadataSearchText(metadata)}`
      return (
        (kind === 'all' || source.kind === kind) &&
        (!normalizedQuery || searchable.toLocaleLowerCase('ko-KR').includes(normalizedQuery))
      )
    })

    return sorted.toSorted((left, right) => {
      switch (sortKey) {
        case 'title-asc':
          return left.title.localeCompare(right.title)
        case 'title-desc':
          return right.title.localeCompare(left.title)
        case 'publisher-asc':
          return left.publisher.localeCompare(right.publisher)
        case 'publisher-desc':
          return right.publisher.localeCompare(left.publisher)
        case 'kind-asc':
          return sourceKindLabel(left.kind).localeCompare(sourceKindLabel(right.kind))
        case 'lastChecked-desc':
          return right.lastChecked.localeCompare(left.lastChecked)
        case 'lastChecked-asc':
          return left.lastChecked.localeCompare(right.lastChecked)
        default:
          return 0
      }
    })
  }, [kind, publisherQuery, sortKey, sourceItems])

  const visibleSources = sourceLimit === 0 ? filteredSources : filteredSources.slice(0, sourceLimit)

  const resetFilters = () => {
    setKind('all')
    setPublisherQuery('')
    setSortKey('title-asc')
    setSourceLimit(0)
  }

  const isResetDisabled =
    kind === 'all' && publisherQuery.trim() === '' && sortKey === 'title-asc' && sourceLimit === 0

  return (
    <section id="sources" className="space-y-4">
      <SectionHeader
        icon={FileText}
        title="출처"
        description="제품 스펙은 공식 문서, 성능 비교는 벤치마크, 학습 자료는 발행 주체별로 구분하고 출처 성격과 발행처로 좁힙니다."
      />
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1.4fr_1.4fr_1fr_0.8fr_1.4fr]">
        <SegmentBar label="출처 성격" items={sourceKindFilters} value={kind} onChange={setKind} />
        <SearchField
          label="발행처/제목 검색"
          value={publisherQuery}
          onChange={setPublisherQuery}
          placeholder="OpenAI, 인프런, 도서, 이벤트"
        />
        <SortSelect value={sortKey} onChange={setSortKey} options={sortOptions} />
        <Select
          label="표시 개수"
          value={sourceLimit}
          onChange={setSourceLimit}
          options={limitOptions}
        />
        <ResultSummary
          shown={visibleSources.length}
          total={filteredSources.length}
          onReset={resetFilters}
          resetDisabled={isResetDisabled}
        />
      </div>

      {visibleSources.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleSources.map((source) => {
            const metadata = getSourceMetadata(source)
            return (
              <a
                key={source.id}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-surface p-4 transition hover:border-border-strong"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <BrandMark
                      domain={metadata.sourceDomain ?? source.url}
                      label={source.publisher}
                      size="sm"
                    />
                    <SourceKindBadge kind={source.kind} />
                  </span>
                  <ExternalLink className="size-3.5 text-text-subtle" aria-hidden />
                </span>
                <span className="mt-3 block text-sm font-semibold text-text">{source.title}</span>
                <span className="mt-1 block text-xs font-medium text-accent">
                  {source.publisher}
                </span>
                <span className="mt-2 block text-xs leading-5 text-text-muted">{source.note}</span>
                <MetadataChips
                  items={[
                    { label: '도메인', value: metadata.sourceDomain },
                    {
                      label: '연결 도메인',
                      value: metadata.sourceDomains?.slice(0, 3).join(', '),
                    },
                    { label: '자료형', value: metadata.contentType },
                    { label: '수집일', value: metadata.collectedAt },
                    { label: '검증일', value: metadata.verifiedAt },
                  ]}
                  limit={6}
                />
              </a>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 출처가 없습니다"
          body="출처 성격을 전체로 바꾸거나 발행처 검색어를 줄이세요."
        />
      )}
    </section>
  )
}
