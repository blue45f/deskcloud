import {
  type ProviderId,
  eventScheduleItems,
  type EventScheduleItem,
  type EventScheduleType,
  getCatalogStats,
  getContentMetadataSearchText,
  getEventScheduleMetadata,
  getLearningResourceMetadata,
  getProviderLabel,
  getSources,
  getSourceMetadata,
  getUpdateMetadata,
  learningResources,
  SNAPSHOT_DATE,
  sources,
  updates,
  type SearchResults,
  type SourceRef,
  type SourceKind,
} from '@aidigestdesk/content'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Gauge,
  MapPin,
  Newspaper,
  SlidersHorizontal,
  Sparkles,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  EmptyState,
  MetadataChips,
  MultiSegmentBar,
  SectionHeader,
  SortSelect,
} from '@/components/app/CommonUi'
import { CountUp } from '@/components/app/Motion'
import { type LocaleAwareFilterDefaults, getLocaleAwareFilterDefaults } from '@/utils/environment'

const stats = getCatalogStats()

const providerSummary = [
  { label: '제공사', value: stats.providers },
  { label: '업데이트', value: stats.updates },
  { label: 'AI 도구', value: stats.aiCodingTools },
  { label: '벤치마크', value: stats.benchmarkRows },
  { label: '출처', value: stats.sources },
] as const

function sourceUrl(sourceId: string) {
  return getSources([sourceId])[0]?.url ?? '#'
}

const scheduleTypeFilters: Array<{ id: EventScheduleType | 'all'; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '해커톤', label: '해커톤' },
  { id: '컨퍼런스', label: '컨퍼런스' },
  { id: '웨비나', label: '웨비나' },
  { id: '세미나/모임', label: '세미나' },
  { id: '공모전/챌린지', label: '챌린지' },
  { id: '프로모션/지원', label: '지원' },
]

type EventScheduleRegionFilter = EventScheduleItem['region'] | 'all'
type EventScheduleLanguageFilter = EventScheduleItem['language'] | 'all'
type EventScheduleFormatFilter = EventScheduleItem['format'] | 'all'
type EventScheduleStatusFilter = EventScheduleItem['status'] | 'all'
type EventScheduleAreaScope = 'all' | '국내' | '국외'
type WebzineNewsSortMode = 'date' | 'title' | 'provider' | 'category'
type WebzineNewsSortDirection = 'asc' | 'desc'
type WebzineNewsCategoryFilter = 'all' | 'news' | 'events' | 'vibe' | 'design'
type WebzineCommunityLanguageFilter = 'all' | '한국어' | '영어'
type WebzineCommunityTypeFilter = 'all' | '강좌/영상' | '블로그/글' | '커뮤니티' | '도서'
type WebzineCommunitySortMode = 'language' | 'title' | 'type' | 'provider'
type WebzineCommunitySortDirection = 'asc' | 'desc'
type WebzineListLimit = number
type EventPromotionSortMode = 'date' | 'title' | 'provider' | 'type'
type EventPromotionSortDirection = 'asc' | 'desc'
type EventCalendarAgendaSortMode = 'date' | 'title' | 'organizer' | 'status'
type EventCalendarAgendaSortDirection = 'asc' | 'desc'
type BriefingSortMode = 'date' | 'title' | 'provider' | 'category' | 'impact'
type BriefingSortDirection = 'asc' | 'desc'
type BriefingProviderFilter = 'all' | ProviderId | 'market'
type SourceWatchSortMode = 'publisher' | 'title' | 'kind' | 'note' | 'checked'
type SourceWatchSortDirection = 'asc' | 'desc'
type SourceWatchKindFilter = 'all' | SourceKind
type ActiveEventScheduleTypeFilter = Exclude<EventScheduleType | 'all', 'all'>
type ActiveEventScheduleRegionFilter = Exclude<EventScheduleRegionFilter, 'all'>
type ActiveEventScheduleLanguageFilter = Exclude<EventScheduleLanguageFilter, 'all'>
type ActiveEventScheduleFormatFilter = Exclude<EventScheduleFormatFilter, 'all'>
type ActiveEventScheduleStatusFilter = Exclude<EventScheduleStatusFilter, 'all'>
type ActiveWebzineNewsCategoryFilter = Exclude<WebzineNewsCategoryFilter, 'all'>
type ActiveWebzineCommunityLanguageFilter = Exclude<WebzineCommunityLanguageFilter, 'all'>
type ActiveWebzineCommunityTypeFilter = Exclude<WebzineCommunityTypeFilter, 'all'>

const scheduleRegionFilters: Array<{ id: EventScheduleRegionFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '국내', label: '국내' },
  { id: '북미', label: '북미' },
  { id: '유럽', label: '유럽' },
  { id: '글로벌', label: '글로벌' },
]

const scheduleLanguageFilters: Array<{ id: EventScheduleLanguageFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '한국어', label: '한국어' },
  { id: '영어', label: '영어' },
  { id: '다국어', label: '다국어' },
]

const scheduleFormatFilters: Array<{ id: EventScheduleFormatFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '온라인', label: '온라인' },
  { id: '오프라인', label: '오프라인' },
  { id: '하이브리드', label: '하이브리드' },
  { id: '상시 확인', label: '상시 확인' },
]

const scheduleStatusFilters: Array<{ id: EventScheduleStatusFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '모집중', label: '모집중' },
  { id: '진행중', label: '진행중' },
  { id: '진행예정', label: '진행예정' },
  { id: '종료', label: '종료' },
  { id: '상시 확인', label: '상시 확인' },
]

const scheduleAreaScopeFilters: Array<{ id: EventScheduleAreaScope; label: string }> = [
  { id: '국내', label: '국내' },
  { id: '국외', label: '국외' },
  { id: 'all', label: '전체' },
]

function toIcsDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll('-', '')
}

function toNextDate(date: Date) {
  const nextDate = new Date(date)
  nextDate.setDate(date.getDate() + 1)
  return nextDate
}

function escapeICSText(value: string) {
  return value.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n')
}

function buildEventIcs(items: EventScheduleItem[]) {
  const now = new Date()
  const stamp = now.toISOString().replace(/[-:.]/g, '').replace('Z', 'Z')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    'PRODID:-//AIDigestDesk//Event Calendar//KO',
  ]

  for (const item of items) {
    const startDate = parseDate(item.startDate)
    const endDate = toNextDate(parseDate(item.endDate ?? item.startDate))

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${item.id}@aidigestdesk`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART;VALUE=DATE:${toIcsDate(startDate)}`)
    lines.push(`DTEND;VALUE=DATE:${toIcsDate(endDate)}`)
    lines.push(`SUMMARY:${escapeICSText(item.title)}`)
    lines.push(`DESCRIPTION:${escapeICSText(`${item.summary} / ${item.relevance}`)}`)
    lines.push(`LOCATION:${escapeICSText(item.location)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return `${lines.join('\n')}\n`
}

function downloadEventsAsIcs(items: EventScheduleItem[]) {
  const safeFileName = `aidigestdesk-events-${new Date().toISOString().slice(0, 10)}.ics`
  const blob = new Blob([buildEventIcs(items)], {
    type: 'text/calendar;charset=utf-8',
  })
  const link = document.createElement('a')
  const blobUrl = URL.createObjectURL(blob)
  link.href = blobUrl
  link.download = safeFileName
  link.click()
  URL.revokeObjectURL(blobUrl)
}

function FilterButton<T extends string>({
  value,
  label,
  selected,
  onSelect,
}: {
  label: string
  value: T
  selected: T
  onSelect: (next: T) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={
        selected === value
          ? 'rounded-md border border-ink bg-ink px-2.5 py-1.5 text-xs font-semibold text-ink-fg'
          : 'rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text'
      }
    >
      {label}
    </button>
  )
}

const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일'] as const

function parseDate(value: string) {
  const [year = 1970, month = 1, day = 1] = value.split('-').map((part) => Number(part))
  return new Date(year, month - 1, day)
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1)
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
  }).format(date)
}

function formatDateRange(item: EventScheduleItem) {
  const start = item.startDate.replaceAll('-', '.')
  if (!item.endDate || item.endDate === item.startDate) return start
  return `${start} - ${item.endDate.replaceAll('-', '.')}`
}

function getScheduleEndDate(item: EventScheduleItem) {
  return item.endDate ?? item.startDate
}

function isSameMonth(dateKey: string, monthDate: Date) {
  const date = parseDate(dateKey)
  return date.getFullYear() === monthDate.getFullYear() && date.getMonth() === monthDate.getMonth()
}

function eventTouchesDate(item: EventScheduleItem, dateKey: string) {
  return item.startDate <= dateKey && getScheduleEndDate(item) >= dateKey
}

function eventTouchesMonth(item: EventScheduleItem, monthDate: Date) {
  const firstDay = toDateKey(startOfMonth(monthDate))
  const lastDay = toDateKey(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0))
  return item.startDate <= lastDay && getScheduleEndDate(item) >= firstDay
}

function statusClass(status: EventScheduleItem['status']) {
  switch (status) {
    case '모집중':
    case '진행중':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
    case '진행예정':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
    case '상시 확인':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
    case '종료':
      return 'border-border bg-bg text-text-subtle'
  }
}

function webzineNewsCategoryLabel(category: string) {
  switch (category) {
    case 'news':
      return '뉴스'
    case 'events':
      return '이벤트'
    case 'vibe':
      return '바이브 코딩'
    case 'design':
      return '디자인/PPT'
    default:
      return '기타'
  }
}

function formatCommunityProviderLabels(resource: { providerIds?: ProviderId[] }) {
  if (!resource.providerIds?.length) return '공식 출처'
  return resource.providerIds
    .map((providerId) => getProviderLabel(providerId) ?? '기타')
    .join(' · ')
}

/** "<mode>-<direction>" 결합값을 마지막 '-' 기준으로 분리한다. */
function splitSortValue<Mode extends string, Direction extends string>(
  value: string
): { mode: Mode; direction: Direction } {
  const splitIndex = value.lastIndexOf('-')
  return {
    mode: value.slice(0, splitIndex) as Mode,
    direction: value.slice(splitIndex + 1) as Direction,
  }
}

export function Briefing({
  results,
  useFallback,
}: {
  results: SearchResults
  useFallback: boolean
}) {
  const [briefingQuery, setBriefingQuery] = useState('')
  const [briefingProviderFilter, setBriefingProviderFilter] =
    useState<BriefingProviderFilter>('all')
  const [briefingSortMode, setBriefingSortMode] = useState<BriefingSortMode>('date')
  const [briefingSortDirection, setBriefingSortDirection] = useState<BriefingSortDirection>('desc')
  const [briefingLimit, setBriefingLimit] = useState<WebzineListLimit>(3)
  const briefingSourceData = results.updates.length || !useFallback ? results.updates : updates
  const briefingProviders = useMemo(() => {
    const providers = Array.from(
      new Set(briefingSourceData.map((item) => item.providerId))
    ).toSorted((left, right) => (left || '기타').localeCompare(right || '기타'))
    return ['all', ...providers] as BriefingProviderFilter[]
  }, [briefingSourceData])
  const briefingSortOptions: Array<{ value: string; label: string }> = [
    { value: 'date-desc', label: '날짜 최신순' },
    { value: 'date-asc', label: '날짜 오래된순' },
    { value: 'title-asc', label: '제목 A→Z' },
    { value: 'title-desc', label: '제목 Z→A' },
    { value: 'provider-asc', label: '제공사 오름차순' },
    { value: 'provider-desc', label: '제공사 내림차순' },
    { value: 'category-asc', label: '카테고리 오름차순' },
    { value: 'category-desc', label: '카테고리 내림차순' },
    { value: 'impact-asc', label: '임팩트 오름차순' },
    { value: 'impact-desc', label: '임팩트 내림차순' },
  ]
  const searchBriefing = briefingQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredBriefingUpdates = useMemo(() => {
    const direction = briefingSortDirection === 'asc' ? 1 : -1
    return briefingSourceData
      .filter(
        (item) => briefingProviderFilter === 'all' || item.providerId === briefingProviderFilter
      )
      .filter((item) => {
        if (!searchBriefing) return true
        const metadata = getUpdateMetadata(item)
        return `${item.title} ${item.summary} ${item.impact} ${item.date} ${item.tags.join(
          ' '
        )} ${webzineNewsCategoryLabel(item.category)} ${getContentMetadataSearchText(metadata)}`
          .toLocaleLowerCase('ko-KR')
          .includes(searchBriefing)
      })
      .toSorted((left, right) => {
        if (briefingSortMode === 'date') {
          return left.date.localeCompare(right.date) * direction
        }
        if (briefingSortMode === 'title') {
          return left.title.localeCompare(right.title) * direction
        }
        if (briefingSortMode === 'provider') {
          return (
            (getProviderLabel(left.providerId) ?? '기타').localeCompare(
              getProviderLabel(right.providerId) ?? '기타'
            ) * direction
          )
        }
        if (briefingSortMode === 'category') {
          return (
            webzineNewsCategoryLabel(left.category).localeCompare(
              webzineNewsCategoryLabel(right.category)
            ) * direction
          )
        }
        return left.impact.localeCompare(right.impact) * direction
      })
  }, [
    briefingProviderFilter,
    briefingSortDirection,
    briefingSortMode,
    briefingSourceData,
    searchBriefing,
  ])
  const visibleBriefingUpdates =
    briefingLimit === 0 ? filteredBriefingUpdates : filteredBriefingUpdates.slice(0, briefingLimit)
  return (
    <section id="updates" className="grid items-start gap-4 xl:grid-cols-[1fr_21rem]">
      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-text sm:text-3xl">오늘의 AI 브리핑</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-text-muted">
              GPT, Claude, Gemini, Grok, Manus, Kimi, DeepSeek, Qwen, Mistral의 최신 스펙과 AI
              바이브 코딩 판단 포인트를 한국어로 비교합니다.
            </p>
          </div>
          <a
            href={sourceUrl('aa-leaderboard')}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-bg px-3 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
          >
            벤치마크 원문 <ExternalLink className="size-3.5" aria-hidden />
          </a>
        </div>
        <div className="mt-4 grid gap-2 xl:grid-cols-[1.4fr_1fr_1fr_1.1fr]">
          <label className="block xl:col-span-2">
            <span className="text-xs font-semibold text-text-subtle">브리핑 검색</span>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
              <input
                value={briefingQuery}
                onChange={(event) => setBriefingQuery(event.target.value)}
                placeholder="제목, 임팩트, 키워드"
                className="h-10 w-full rounded-md border border-border bg-bg px-9 py-2 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-subtle">제공사</span>
            <select
              value={briefingProviderFilter}
              onChange={(event) =>
                setBriefingProviderFilter(event.target.value as BriefingProviderFilter)
              }
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              {briefingProviders.map((provider) => (
                <option key={provider} value={provider}>
                  {provider === 'all' ? '전체' : getProviderLabel(provider)}
                </option>
              ))}
            </select>
          </label>
          <SortSelect
            value={`${briefingSortMode}-${briefingSortDirection}`}
            onChange={(next) => {
              const { mode, direction } = splitSortValue<
                BriefingSortMode,
                BriefingSortDirection
              >(next)
              setBriefingSortMode(mode)
              setBriefingSortDirection(direction)
            }}
            options={briefingSortOptions}
          />
          <label className="block">
            <span className="text-xs font-semibold text-text-subtle">표시 개수</span>
            <select
              value={briefingLimit}
              onChange={(event) => setBriefingLimit(Number(event.target.value))}
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value={0}>전체</option>
              <option value={3}>3개</option>
              <option value={5}>5개</option>
              <option value={10}>10개</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-bg p-2 px-3">
          <p className="text-xs font-semibold text-text-subtle">
            표시 {visibleBriefingUpdates.length}개 / 전체 {filteredBriefingUpdates.length}개
          </p>
          <button
            type="button"
            onClick={() => {
              setBriefingQuery('')
              setBriefingProviderFilter('all')
              setBriefingSortMode('date')
              setBriefingSortDirection('desc')
              setBriefingLimit(3)
            }}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:text-text"
          >
            초기화
          </button>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-5">
          {providerSummary.map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-border bg-bg p-3 transition-colors duration-200 hover:border-border-strong"
            >
              <p className="text-xs text-text-subtle">{item.label}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-text">
                <CountUp value={item.value} />
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {visibleBriefingUpdates.length ? (
            visibleBriefingUpdates.map((item) => {
              const metadata = getUpdateMetadata(item)
              return (
                <article
                  key={item.id}
                  className="grid gap-3 rounded-md border border-border bg-bg p-4 md:grid-cols-[8rem_1fr]"
                >
                  <div>
                    <p className="text-xs font-semibold text-text-subtle">{item.date}</p>
                    <p className="mt-1 text-xs font-semibold text-accent">
                      {getProviderLabel(item.providerId)}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-text">{item.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{item.summary}</p>
                    <p className="mt-2 text-xs leading-5 text-text-subtle">{item.impact}</p>
                    <MetadataChips
                      items={[
                        { label: '발행일', value: metadata.publishedAt },
                        { label: '등록일', value: metadata.registeredAt },
                        { label: '뉴스 출처', value: metadata.newsSources?.slice(0, 2).join(', ') },
                        { label: '도메인', value: metadata.sourceDomains?.slice(0, 2).join(', ') },
                        { label: '확인일', value: metadata.lastCheckedAt },
                      ]}
                      limit={5}
                    />
                  </div>
                </article>
              )
            })
          ) : (
            <EmptyState
              title="조건에 맞는 업데이트가 없습니다"
              body="검색어 또는 제공사 필터를 줄이면 관련 업데이트가 다시 표시됩니다."
            />
          )}
        </div>
      </div>
      <SourceWatch sources={results.sources.length ? results.sources : sources} />
    </section>
  )
}

function SourceWatch({ sources: visibleSources }: { sources: SourceRef[] }) {
  const [sourceWatchQuery, setSourceWatchQuery] = useState('')
  const [sourceWatchKindFilter, setSourceWatchKindFilter] = useState<SourceWatchKindFilter>('all')
  const [sourceWatchSortMode, setSourceWatchSortMode] = useState<SourceWatchSortMode>('checked')
  const [sourceWatchSortDirection, setSourceWatchSortDirection] =
    useState<SourceWatchSortDirection>('desc')
  const [sourceWatchLimit, setSourceWatchLimit] = useState<WebzineListLimit>(3)
  const sourceWatchSortOptions: Array<{ value: string; label: string }> = [
    { value: 'checked-desc', label: '확인일 최신순' },
    { value: 'checked-asc', label: '확인일 오래된순' },
    { value: 'publisher-asc', label: '출처 A→Z' },
    { value: 'publisher-desc', label: '출처 Z→A' },
    { value: 'title-asc', label: '제목 A→Z' },
    { value: 'title-desc', label: '제목 Z→A' },
    { value: 'kind-asc', label: '출처 성격 오름차순' },
    { value: 'kind-desc', label: '출처 성격 내림차순' },
    { value: 'note-asc', label: '메모 오름차순' },
    { value: 'note-desc', label: '메모 내림차순' },
  ]
  const sourceWatchKindFilters = useMemo(() => {
    const kindValues = Array.from(new Set(visibleSources.map((source) => source.kind)))
    return ['all', ...kindValues] as SourceWatchKindFilter[]
  }, [visibleSources])
  const sourceWatchSearch = sourceWatchQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredSourceWatch = useMemo(
    () =>
      visibleSources
        .filter(
          (source) => sourceWatchKindFilter === 'all' || source.kind === sourceWatchKindFilter
        )
        .filter((source) => {
          if (!sourceWatchSearch) return true
          const metadata = getSourceMetadata(source)
          return `${source.publisher} ${source.title} ${source.note} ${
            source.kind
          } ${getContentMetadataSearchText(metadata)}`
            .toLocaleLowerCase('ko-KR')
            .includes(sourceWatchSearch)
        })
        .toSorted((left, right) => {
          const direction = sourceWatchSortDirection === 'asc' ? 1 : -1
          if (sourceWatchSortMode === 'publisher') {
            return left.publisher.localeCompare(right.publisher) * direction
          }
          if (sourceWatchSortMode === 'title') {
            return left.title.localeCompare(right.title) * direction
          }
          if (sourceWatchSortMode === 'kind') {
            return left.kind.localeCompare(right.kind) * direction
          }
          if (sourceWatchSortMode === 'note') {
            return left.note.localeCompare(right.note) * direction
          }
          return right.lastChecked.localeCompare(left.lastChecked) * direction
        }),
    [
      sourceWatchKindFilter,
      sourceWatchSearch,
      sourceWatchSortDirection,
      sourceWatchSortMode,
      visibleSources,
    ]
  )
  const visibleFilteredSources =
    sourceWatchLimit === 0 ? filteredSourceWatch : filteredSourceWatch.slice(0, sourceWatchLimit)

  return (
    <aside className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-text">소스 워치</h2>
        <Gauge className="size-4 text-text-subtle" aria-hidden />
      </div>
      <div className="mt-4 space-y-3">
        <div className="grid gap-2">
          <label className="block">
            <span className="text-xs font-semibold text-text-subtle">출처 검색</span>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
              <input
                value={sourceWatchQuery}
                onChange={(event) => setSourceWatchQuery(event.target.value)}
                placeholder="공식 문서, 공식 채널, 벤치마크"
                className="h-10 w-full rounded-md border border-border bg-bg px-9 py-2 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
              />
            </div>
          </label>
          <div className="grid gap-2 xl:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-text-subtle">출처 성격</span>
              <select
                value={sourceWatchKindFilter}
                onChange={(event) =>
                  setSourceWatchKindFilter(event.target.value as SourceWatchKindFilter)
                }
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                {sourceWatchKindFilters.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind === 'all' ? '전체' : kind}
                  </option>
                ))}
              </select>
            </label>
            <SortSelect
              value={`${sourceWatchSortMode}-${sourceWatchSortDirection}`}
              onChange={(next) => {
                const { mode, direction } = splitSortValue<
                  SourceWatchSortMode,
                  SourceWatchSortDirection
                >(next)
                setSourceWatchSortMode(mode)
                setSourceWatchSortDirection(direction)
              }}
              options={sourceWatchSortOptions}
            />
          </div>
          <div className="grid gap-2 xl:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-text-subtle">표시 개수</span>
              <select
                value={sourceWatchLimit}
                onChange={(event) => setSourceWatchLimit(Number(event.target.value))}
                className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
              >
                <option value={0}>전체</option>
                <option value={3}>3개</option>
                <option value={5}>5개</option>
                <option value={10}>10개</option>
              </select>
            </label>
            <div className="rounded-md border border-border bg-bg p-2">
              <p className="text-xs font-semibold text-text-subtle">
                표시 {visibleFilteredSources.length}개 / 전체 {filteredSourceWatch.length}개
              </p>
              <button
                type="button"
                onClick={() => {
                  setSourceWatchQuery('')
                  setSourceWatchKindFilter('all')
                  setSourceWatchSortMode('checked')
                  setSourceWatchSortDirection('desc')
                  setSourceWatchLimit(3)
                }}
                className="mt-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:text-text"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {visibleFilteredSources.map((source) => {
          const metadata = getSourceMetadata(source)
          return (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md border border-border bg-bg p-3 transition hover:border-border-strong"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-text">{source.publisher}</span>
                <ExternalLink className="size-3.5 text-text-subtle" aria-hidden />
              </span>
              <span className="mt-1 block text-sm font-medium text-text">{source.title}</span>
              <span className="mt-1 block text-xs leading-5 text-text-subtle">{source.note}</span>
              <MetadataChips
                items={[
                  { label: '도메인', value: metadata.sourceDomain },
                  { label: '연결 도메인', value: metadata.sourceDomains?.slice(0, 2).join(', ') },
                  { label: '자료형', value: metadata.contentType },
                  { label: '수집일', value: metadata.collectedAt },
                  { label: '검증일', value: metadata.verifiedAt },
                ]}
                limit={5}
              />
            </a>
          )
        })}
      </div>
    </aside>
  )
}

export function WebzineSection({
  results,
  useFallback,
}: {
  results: SearchResults
  useFallback: boolean
}) {
  const localeAwareDefaults: LocaleAwareFilterDefaults = getLocaleAwareFilterDefaults()
  const [selectedNewsCategories, setSelectedNewsCategories] = useState<
    ActiveWebzineNewsCategoryFilter[]
  >([])
  const [newsSortMode, setNewsSortMode] = useState<WebzineNewsSortMode>('date')
  const [newsSortDirection, setNewsSortDirection] = useState<WebzineNewsSortDirection>('desc')
  const [newsQuery, setNewsQuery] = useState('')
  const [communityQuery, setCommunityQuery] = useState('')
  const [newsLimit, setNewsLimit] = useState<WebzineListLimit>(5)
  const [communitySortMode, setCommunitySortMode] = useState<WebzineCommunitySortMode>('language')
  const [communitySortDirection, setCommunitySortDirection] =
    useState<WebzineCommunitySortDirection>('asc')
  const [communityLanguageFiltersActive, setCommunityLanguageFiltersActive] = useState<
    ActiveWebzineCommunityLanguageFilter[]
  >(() =>
    localeAwareDefaults.communityLanguage === 'all' ? [] : [localeAwareDefaults.communityLanguage]
  )
  const [communityTypeFiltersActive, setCommunityTypeFiltersActive] = useState<
    ActiveWebzineCommunityTypeFilter[]
  >([])
  const [communityLimit, setCommunityLimit] = useState<WebzineListLimit>(6)

  const newsCategoryFilterItems: Array<{
    id: WebzineNewsCategoryFilter
    label: string
  }> = [
    { id: 'all', label: '전체' },
    { id: 'news', label: '뉴스' },
    { id: 'events', label: '이벤트' },
    { id: 'vibe', label: '바이브 코딩' },
    { id: 'design', label: '디자인/PPT' },
  ]
  const newsSortOptions: Array<{ value: string; label: string }> = [
    { value: 'date-desc', label: '날짜 최신순' },
    { value: 'date-asc', label: '날짜 오래된순' },
    { value: 'title-asc', label: '제목 A→Z' },
    { value: 'title-desc', label: '제목 Z→A' },
    { value: 'provider-asc', label: '제공사 오름차순' },
    { value: 'provider-desc', label: '제공사 내림차순' },
    { value: 'category-asc', label: '구분 오름차순' },
    { value: 'category-desc', label: '구분 내림차순' },
  ]
  const communityLanguageFilters: Array<{
    id: WebzineCommunityLanguageFilter
    label: string
  }> = [
    { id: 'all', label: '전체' },
    { id: '한국어', label: '한국어' },
    { id: '영어', label: '영어' },
  ]
  const communityTypeFilters: Array<{
    id: WebzineCommunityTypeFilter
    label: string
  }> = [
    { id: 'all', label: '전체' },
    { id: '강좌/영상', label: '강좌/영상' },
    { id: '블로그/글', label: '블로그/글' },
    { id: '커뮤니티', label: '커뮤니티' },
    { id: '도서', label: '도서' },
  ]
  const communitySortOptions: Array<{ value: string; label: string }> = [
    { value: 'language-asc', label: '언어 오름차순' },
    { value: 'language-desc', label: '언어 내림차순' },
    { value: 'title-asc', label: '제목 A→Z' },
    { value: 'title-desc', label: '제목 Z→A' },
    { value: 'type-asc', label: '유형 오름차순' },
    { value: 'type-desc', label: '유형 내림차순' },
    { value: 'provider-asc', label: '제공사 오름차순' },
    { value: 'provider-desc', label: '제공사 내림차순' },
  ]

  const searchNews = newsQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredNewsItems = useMemo(
    () =>
      (results.updates.length || !useFallback ? results.updates : updates)
        .filter((item) => ['news', 'events', 'vibe', 'design'].includes(item.category))
        .filter(
          (item) =>
            selectedNewsCategories.length === 0 ||
            selectedNewsCategories.includes(item.category as ActiveWebzineNewsCategoryFilter)
        )
        .filter((item) => {
          if (!searchNews) return true
          const metadata = getUpdateMetadata(item)
          return `${item.title} ${item.summary} ${item.impact} ${item.date} ${item.tags.join(' ')} ${webzineNewsCategoryLabel(item.category)} ${getContentMetadataSearchText(metadata)}`
            .toLocaleLowerCase('ko-KR')
            .includes(searchNews)
        })
        .toSorted((left, right) => {
          const direction = newsSortDirection === 'asc' ? 1 : -1
          if (newsSortMode === 'date') return left.date.localeCompare(right.date) * direction
          if (newsSortMode === 'title') return left.title.localeCompare(right.title) * direction
          if (newsSortMode === 'provider')
            return (
              (getProviderLabel(left.providerId) ?? '기타').localeCompare(
                getProviderLabel(right.providerId) ?? '기타'
              ) * direction
            )
          return (
            webzineNewsCategoryLabel(left.category).localeCompare(
              webzineNewsCategoryLabel(right.category)
            ) * direction
          )
        }),
    [
      selectedNewsCategories,
      searchNews,
      newsSortDirection,
      newsSortMode,
      results.updates,
      useFallback,
    ]
  )
  const visibleMagazineUpdates =
    newsLimit === 0 ? filteredNewsItems : filteredNewsItems.slice(0, newsLimit)
  const lead = visibleMagazineUpdates[0]
  const sideItems = visibleMagazineUpdates.slice(1)
  const leadMetadata = lead ? getUpdateMetadata(lead) : null

  const searchCommunity = communityQuery.trim().toLocaleLowerCase('ko-KR')
  const filteredCommunityItems = useMemo(
    () =>
      (results.resources.length || !useFallback ? results.resources : learningResources)
        .filter((resource) =>
          ['강좌/영상', '블로그/글', '커뮤니티', '도서'].includes(resource.type)
        )
        .filter(
          (resource) =>
            communityTypeFiltersActive.length === 0 ||
            communityTypeFiltersActive.includes(resource.type as ActiveWebzineCommunityTypeFilter)
        )
        .filter(
          (resource) =>
            communityLanguageFiltersActive.length === 0 ||
            communityLanguageFiltersActive.includes(
              resource.language as ActiveWebzineCommunityLanguageFilter
            )
        )
        .filter((resource) => {
          if (!searchCommunity) return true
          const metadata = getLearningResourceMetadata(resource)
          return `${resource.title} ${resource.summary} ${resource.author} ${resource.level} ${resource.type} ${resource.language} ${formatCommunityProviderLabels(resource)} ${resource.tags.join(' ')} ${getContentMetadataSearchText(metadata)}`
            .toLocaleLowerCase('ko-KR')
            .includes(searchCommunity)
        })
        .toSorted((left, right) => {
          const direction = communitySortDirection === 'asc' ? 1 : -1
          if (communitySortMode === 'language')
            return left.language.localeCompare(right.language) * direction
          if (communitySortMode === 'provider')
            return (
              formatCommunityProviderLabels(left).localeCompare(
                formatCommunityProviderLabels(right)
              ) * direction
            )
          if (communitySortMode === 'type') return left.type.localeCompare(right.type) * direction
          return left.title.localeCompare(right.title) * direction
        }),
    [
      communityLanguageFiltersActive,
      searchCommunity,
      communitySortDirection,
      communitySortMode,
      communityTypeFiltersActive,
      results.resources,
      useFallback,
    ]
  )
  const visibleCommunityItems =
    communityLimit === 0 ? filteredCommunityItems : filteredCommunityItems.slice(0, communityLimit)

  return (
    <section id="webzine" className="space-y-4">
      <SectionHeader
        icon={Newspaper}
        title="AI 뉴스와 커뮤니티 웹진"
        description="모델 릴리스, AI 주권/규제 뉴스, 한국어 유튜브·블로그·도서 자료를 웹진형으로 묶었습니다."
      />
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1fr_1fr_10rem_8rem_auto]">
        <MultiSegmentBar
          label="웹진 구분"
          items={newsCategoryFilterItems}
          value={selectedNewsCategories}
          onChange={setSelectedNewsCategories}
        />
        <label className="block">
          <span className="text-xs font-semibold text-text-subtle">웹진 검색</span>
          <input
            value={newsQuery}
            onChange={(event) => setNewsQuery(event.target.value)}
            placeholder="뉴스, 릴리스, 태스크, 비용 비교"
            className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
          />
        </label>
        <SortSelect
          value={`${newsSortMode}-${newsSortDirection}`}
          onChange={(next) => {
            const { mode, direction } = splitSortValue<
              WebzineNewsSortMode,
              WebzineNewsSortDirection
            >(next)
            setNewsSortMode(mode)
            setNewsSortDirection(direction)
          }}
          options={newsSortOptions}
        />
        <label className="block">
          <span className="text-xs font-semibold text-text-subtle">표시 개수</span>
          <select
            value={newsLimit}
            onChange={(event) => setNewsLimit(Number(event.target.value))}
            className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
          >
            <option value={0}>전체</option>
            <option value={5}>5개</option>
            <option value={10}>10개</option>
            <option value={20}>20개</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setNewsQuery('')
            setSelectedNewsCategories([])
            setNewsSortMode('date')
            setNewsSortDirection('desc')
            setNewsLimit(5)
          }}
          className="rounded-md border border-border bg-bg px-2.5 py-2 text-xs font-semibold text-text-muted transition hover:text-text"
        >
          초기화
        </button>
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="text-xs font-semibold text-text-subtle">필터 결과</p>
          <p className="mt-1 text-lg font-semibold text-text">
            표시 {visibleMagazineUpdates.length}개 / 전체 {filteredNewsItems.length}개
          </p>
        </div>
      </div>
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1fr_1fr]">
          <MultiSegmentBar
            label="자료 언어"
            items={communityLanguageFilters}
            value={communityLanguageFiltersActive}
            onChange={setCommunityLanguageFiltersActive}
          />
          <MultiSegmentBar
            label="자료 유형"
            items={communityTypeFilters}
            value={communityTypeFiltersActive}
            onChange={setCommunityTypeFiltersActive}
          />
          <SortSelect
            value={`${communitySortMode}-${communitySortDirection}`}
            onChange={(next) => {
              const { mode, direction } = splitSortValue<
                WebzineCommunitySortMode,
                WebzineCommunitySortDirection
              >(next)
              setCommunitySortMode(mode)
              setCommunitySortDirection(direction)
            }}
            options={communitySortOptions}
          />
          <label className="block">
            <span className="text-xs font-semibold text-text-subtle">표시 개수</span>
            <select
              value={communityLimit}
              onChange={(event) => setCommunityLimit(Number(event.target.value))}
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition focus:border-accent"
            >
              <option value={0}>전체</option>
              <option value={6}>6개</option>
              <option value={9}>9개</option>
              <option value={12}>12개</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-text-subtle">자료 검색</span>
            <input
              value={communityQuery}
              onChange={(event) => setCommunityQuery(event.target.value)}
              placeholder="인프런, 유튜브, 공식 문서, 도서"
              className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
            />
          </label>
          <div className="rounded-md border border-border bg-bg p-3">
            <p className="text-xs font-semibold text-text-subtle">필터 결과</p>
            <p className="mt-1 text-lg font-semibold text-text">
              표시 {visibleCommunityItems.length}개 / 전체 {filteredCommunityItems.length}개
            </p>
            <button
              type="button"
              onClick={() => {
                setCommunityQuery('')
                setCommunityLanguageFiltersActive(
                  localeAwareDefaults.communityLanguage === 'all'
                    ? []
                    : [localeAwareDefaults.communityLanguage]
                )
                setCommunityTypeFiltersActive([])
                setCommunitySortMode('language')
                setCommunitySortDirection('asc')
                setCommunityLimit(6)
              }}
              className="mt-2 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              초기화
            </button>
          </div>
        </div>
      </div>
      {lead ? (
        <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
          <article className="rounded-lg border border-border bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border bg-bg px-2 py-1 text-xs font-semibold text-accent">
                {lead.category === 'news'
                  ? '뉴스'
                  : lead.category === 'events'
                    ? '이벤트'
                    : lead.category === 'vibe'
                      ? '바이브 코딩'
                      : '디자인/PPT'}
              </span>
              <span className="text-xs font-semibold text-text-subtle">
                {lead.date} · {getProviderLabel(lead.providerId)}
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-semibold leading-tight text-text">{lead.title}</h2>
            <p className="mt-3 text-sm leading-6 text-text-muted">{lead.summary}</p>
            <p className="mt-3 text-sm leading-6 text-text-subtle">{lead.impact}</p>
            <MetadataChips
              items={[
                { label: '작성일', value: leadMetadata?.createdAt },
                { label: '발행일', value: leadMetadata?.publishedAt },
                { label: '등록일', value: leadMetadata?.registeredAt },
                { label: '수정일', value: leadMetadata?.modifiedAt },
                {
                  label: '뉴스 출처',
                  value: leadMetadata?.newsSources?.slice(0, 3).join(', '),
                },
                {
                  label: '도메인',
                  value: leadMetadata?.sourceDomains?.slice(0, 3).join(', '),
                },
                { label: '수집일', value: leadMetadata?.collectedAt },
                { label: '확인일', value: leadMetadata?.lastCheckedAt },
              ]}
              limit={8}
            />
            <div className="mt-4 flex flex-wrap gap-2">
              {lead.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-subtle"
                >
                  {tag}
                </span>
              ))}
            </div>
          </article>

          <aside className="space-y-3">
            {sideItems.map((item) => {
              const metadata = getUpdateMetadata(item)
              return (
                <article key={item.id} className="rounded-lg border border-border bg-surface p-4">
                  <p className="text-xs font-semibold text-accent">
                    {item.date} · {getProviderLabel(item.providerId)}
                  </p>
                  <h3 className="mt-2 text-sm font-semibold leading-5 text-text">{item.title}</h3>
                  <p className="mt-2 text-xs leading-5 text-text-muted">{item.summary}</p>
                  <MetadataChips
                    items={[
                      { label: '발행일', value: metadata.publishedAt },
                      { label: '출처', value: metadata.newsSources?.slice(0, 2).join(', ') },
                      { label: '도메인', value: metadata.sourceDomains?.slice(0, 2).join(', ') },
                      { label: '확인일', value: metadata.lastCheckedAt },
                    ]}
                    limit={4}
                  />
                </article>
              )
            })}
          </aside>
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 웹진 기사가 없습니다"
          body="뉴스 또는 바이브 코딩 카테고리에서 다시 확인하세요."
        />
      )}

      {visibleCommunityItems.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleCommunityItems.map((resource) => {
            const metadata = getLearningResourceMetadata(resource)
            return (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-border bg-surface p-4 transition hover:border-border-strong"
              >
                <span className="flex items-start justify-between gap-3">
                  <span>
                    <span className="rounded-md border border-border bg-bg px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle">
                      {resource.language} · {resource.type}
                    </span>
                    <span className="mt-3 block text-sm font-semibold text-text">
                      {resource.title}
                    </span>
                    <span className="mt-1 block text-xs text-text-subtle">
                      {formatCommunityProviderLabels(resource)}
                    </span>
                  </span>
                  <ExternalLink className="size-3.5 shrink-0 text-text-subtle" aria-hidden />
                </span>
                <span className="mt-2 block text-xs leading-5 text-text-muted">
                  {resource.summary}
                </span>
                <MetadataChips
                  items={[
                    { label: '작성자', value: metadata.authorNames?.join(', ') },
                    { label: '출처', value: metadata.newsSources?.slice(0, 2).join(', ') },
                    { label: '도메인', value: metadata.sourceDomains?.slice(0, 2).join(', ') },
                    { label: '등록일', value: metadata.registeredAt },
                    { label: '수집일', value: metadata.collectedAt },
                    { label: '확인일', value: metadata.lastCheckedAt },
                  ]}
                  limit={6}
                />
              </a>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 커뮤니티 자료가 없습니다"
          body="자료 유형·언어·검색어를 바꿔 다시 확인해 보세요."
        />
      )}
    </section>
  )
}

function EventCalendarBoard() {
  const [activeMonth, setActiveMonth] = useState(() => startOfMonth(parseDate(SNAPSHOT_DATE)))
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const localeAwareDefaults: LocaleAwareFilterDefaults = getLocaleAwareFilterDefaults()
  const [selectedTypes, setSelectedTypes] = useState<ActiveEventScheduleTypeFilter[]>([])
  const [selectedAreaScope, setSelectedAreaScope] = useState<EventScheduleAreaScope>(
    localeAwareDefaults.eventAreaScope
  )
  const [selectedRegions, setSelectedRegions] = useState<ActiveEventScheduleRegionFilter[]>(() =>
    localeAwareDefaults.eventRegion === 'all' ? [] : [localeAwareDefaults.eventRegion]
  )
  const [selectedLanguages, setSelectedLanguages] = useState<ActiveEventScheduleLanguageFilter[]>(
    () => (localeAwareDefaults.eventLanguage === 'all' ? [] : [localeAwareDefaults.eventLanguage])
  )
  const [selectedFormats, setSelectedFormats] = useState<ActiveEventScheduleFormatFilter[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<ActiveEventScheduleStatusFilter[]>([])
  const [query, setQuery] = useState('')
  const [agendaSortMode, setAgendaSortMode] = useState<EventCalendarAgendaSortMode>('date')
  const [agendaSortDirection, setAgendaSortDirection] =
    useState<EventCalendarAgendaSortDirection>('asc')

  const agendaSortOptions: Array<{ value: string; label: string }> = [
    { value: 'date-asc', label: '일자 오래된순' },
    { value: 'date-desc', label: '일자 최신순' },
    { value: 'title-asc', label: '제목 A→Z' },
    { value: 'title-desc', label: '제목 Z→A' },
    { value: 'organizer-asc', label: '주최 오름차순' },
    { value: 'organizer-desc', label: '주최 내림차순' },
    { value: 'status-asc', label: '진행상태 오름차순' },
    { value: 'status-desc', label: '진행상태 내림차순' },
  ]

  const queryLower = query.trim().toLowerCase()

  const resetFilters = () => {
    setSelectedTypes([])
    setSelectedAreaScope(localeAwareDefaults.eventAreaScope)
    setSelectedRegions(
      localeAwareDefaults.eventRegion === 'all' ? [] : [localeAwareDefaults.eventRegion]
    )
    setSelectedLanguages(
      localeAwareDefaults.eventLanguage === 'all' ? [] : [localeAwareDefaults.eventLanguage]
    )
    setSelectedFormats([])
    setSelectedStatuses([])
    setQuery('')
    setSelectedDate(null)
  }

  const filteredEvents = useMemo(
    () =>
      eventScheduleItems
        .filter((item) => selectedTypes.length === 0 || selectedTypes.includes(item.type))
        .filter((item) =>
          selectedAreaScope === 'all'
            ? true
            : selectedAreaScope === '국내'
              ? item.region === '국내'
              : item.region !== '국내'
        )
        .filter((item) => selectedRegions.length === 0 || selectedRegions.includes(item.region))
        .filter(
          (item) => selectedLanguages.length === 0 || selectedLanguages.includes(item.language)
        )
        .filter((item) => selectedFormats.length === 0 || selectedFormats.includes(item.format))
        .filter((item) => selectedStatuses.length === 0 || selectedStatuses.includes(item.status))
        .filter((item) =>
          queryLower
            ? (() => {
                const metadata = getEventScheduleMetadata(item)
                return `${item.title} ${item.organizer} ${item.location} ${item.summary} ${
                  item.relevance
                } ${item.type} ${item.format} ${item.language} ${item.region} ${
                  item.status
                } ${item.tags.join(' ')} ${getContentMetadataSearchText(metadata)}`
                  .toLowerCase()
                  .includes(queryLower)
              })()
            : true
        )
        .toSorted((a, b) => a.startDate.localeCompare(b.startDate)),
    [
      queryLower,
      selectedAreaScope,
      selectedFormats,
      selectedLanguages,
      selectedRegions,
      selectedStatuses,
      selectedTypes,
    ]
  )

  const monthEvents = filteredEvents.filter((item) => eventTouchesMonth(item, activeMonth))
  const sortedAgendaEvents = useMemo(() => {
    const list = (
      selectedDate
        ? filteredEvents.filter((item) => eventTouchesDate(item, selectedDate))
        : monthEvents
    ).toSorted((left, right) => {
      const direction = agendaSortDirection === 'asc' ? 1 : -1
      if (agendaSortMode === 'date')
        return left.startDate.localeCompare(right.startDate) * direction
      if (agendaSortMode === 'title') return left.title.localeCompare(right.title) * direction
      if (agendaSortMode === 'organizer')
        return left.organizer.localeCompare(right.organizer) * direction
      return left.status.localeCompare(right.status) * direction
    })
    return list
  }, [agendaSortDirection, agendaSortMode, filteredEvents, monthEvents, selectedDate])
  const agendaEvents = sortedAgendaEvents
  const exportEvents = selectedDate ? agendaEvents : monthEvents

  const leadingBlankCount = (startOfMonth(activeMonth).getDay() + 6) % 7
  const firstCellDate = new Date(
    activeMonth.getFullYear(),
    activeMonth.getMonth(),
    1 - leadingBlankCount
  )
  const calendarCells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(firstCellDate)
    date.setDate(firstCellDate.getDate() + index)
    const dateKey = toDateKey(date)
    const events = filteredEvents.filter((item) => eventTouchesDate(item, dateKey))
    return {
      date,
      dateKey,
      events,
      inMonth: isSameMonth(dateKey, activeMonth),
      isSelected: selectedDate === dateKey,
      isToday: dateKey === SNAPSHOT_DATE,
    }
  })

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
              <CalendarDays className="size-3.5" aria-hidden />
              일정 캘린더
            </p>
            <h3 className="mt-1 text-lg font-semibold text-text">{formatMonth(activeMonth)}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setActiveMonth((date) => addMonths(date, -1))
                setSelectedDate(null)
              }}
              className="grid size-9 place-items-center rounded-md border border-border bg-bg text-text-muted transition hover:text-text"
              aria-label="이전 달"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMonth(startOfMonth(parseDate(SNAPSHOT_DATE)))
                setSelectedDate(SNAPSHOT_DATE)
              }}
              className="h-9 rounded-md border border-border bg-bg px-3 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              오늘
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveMonth((date) => addMonths(date, 1))
                setSelectedDate(null)
              }}
              className="grid size-9 place-items-center rounded-md border border-border bg-bg text-text-muted transition hover:text-text"
              aria-label="다음 달"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <MultiSegmentBar
            label="일정 유형"
            items={scheduleTypeFilters}
            value={selectedTypes}
            onChange={(nextTypes) => {
              setSelectedTypes(nextTypes)
              setSelectedDate(null)
            }}
          />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {scheduleAreaScopeFilters.map((filter) => (
            <FilterButton
              key={filter.id}
              value={filter.id}
              selected={selectedAreaScope}
              label={filter.label}
              onSelect={(nextScope) => {
                setSelectedAreaScope(nextScope)
                setSelectedDate(null)
                if (nextScope === '국내') {
                  setSelectedRegions(['국내'])
                } else if (nextScope === 'all') {
                  setSelectedRegions([])
                } else {
                  setSelectedRegions([])
                }
              }}
            />
          ))}
        </div>

        <div className="mt-4 space-y-2">
          <div className="relative">
            <label htmlFor="event-search" className="sr-only">
              일정 검색
            </label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
            <input
              id="event-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedDate(null)
              }}
              placeholder="일정명·주최·요약으로 검색"
              className="h-10 w-full rounded-md border border-border bg-bg px-9 text-sm text-text outline-none ring-0 transition placeholder:text-text-subtle focus:border-accent/70 focus:ring-2 focus:ring-accent/20"
            />
          </div>
        </div>

        <div className="mt-4">
          <MultiSegmentBar
            label="지역"
            items={scheduleRegionFilters}
            value={selectedRegions}
            onChange={(nextRegions) => {
              setSelectedRegions(nextRegions)
              setSelectedDate(null)
              if (nextRegions.length === 0) {
                setSelectedAreaScope('all')
              } else if (nextRegions.every((region) => region === '국내')) {
                setSelectedAreaScope('국내')
              } else if (nextRegions.includes('국내')) {
                setSelectedAreaScope('all')
              } else {
                setSelectedAreaScope('국외')
              }
            }}
          />
        </div>
        <div className="mt-2">
          <MultiSegmentBar
            label="언어"
            items={scheduleLanguageFilters}
            value={selectedLanguages}
            onChange={(nextLanguages) => {
              setSelectedLanguages(nextLanguages)
              setSelectedDate(null)
            }}
          />
        </div>
        <div className="mt-2">
          <MultiSegmentBar
            label="진행 방식"
            items={scheduleFormatFilters}
            value={selectedFormats}
            onChange={(nextFormats) => {
              setSelectedFormats(nextFormats)
              setSelectedDate(null)
            }}
          />
        </div>
        <div className="mt-2">
          <MultiSegmentBar
            label="진행 상태"
            items={scheduleStatusFilters}
            value={selectedStatuses}
            onChange={(nextStatuses) => {
              setSelectedStatuses(nextStatuses)
              setSelectedDate(null)
            }}
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-text-subtle">
          <span className="inline-flex items-center rounded-md border border-border bg-bg px-2 py-1">
            검색 결과 {filteredEvents.length}건
          </span>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-md border border-border bg-bg px-2 py-1 font-semibold text-text-subtle transition hover:text-text"
          >
            필터 초기화
          </button>
        </div>
        <div className="mt-3">
          <SortSelect
            label="일정 리스트 정렬"
            value={`${agendaSortMode}-${agendaSortDirection}`}
            onChange={(next) => {
              const { mode, direction } = splitSortValue<
                EventCalendarAgendaSortMode,
                EventCalendarAgendaSortDirection
              >(next)
              setAgendaSortMode(mode)
              setAgendaSortDirection(direction)
            }}
            options={agendaSortOptions}
          />
        </div>

        <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[0.6875rem] font-semibold text-text-subtle">
          {weekdayLabels.map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell) => (
            <button
              key={cell.dateKey}
              type="button"
              onClick={() => setSelectedDate(cell.dateKey)}
              className={`min-h-20 rounded-md border p-1.5 text-left transition sm:min-h-24 ${
                cell.isSelected
                  ? 'border-ink bg-ink text-ink-fg'
                  : cell.isToday
                    ? 'border-accent bg-surface-2 text-text'
                    : 'border-border bg-bg text-text hover:border-border-strong'
              } ${cell.inMonth ? '' : 'opacity-45'}`}
            >
              <span className="block text-xs font-semibold">{cell.date.getDate()}</span>
              {cell.events.length ? (
                <span
                  className={`mt-3 inline-flex size-5 items-center justify-center rounded-full text-[0.625rem] font-semibold sm:hidden ${
                    cell.isSelected ? 'bg-white/15 text-ink-fg' : 'bg-accent text-ink-fg'
                  }`}
                >
                  {cell.events.length}
                </span>
              ) : null}
              <span className="mt-1 hidden space-y-1 sm:block">
                {cell.events.slice(0, 2).map((item) => (
                  <span
                    key={item.id}
                    className={`block truncate rounded-sm px-1.5 py-0.5 text-[0.625rem] font-semibold ${
                      cell.isSelected ? 'bg-white/15 text-ink-fg' : 'bg-surface-2 text-text-muted'
                    }`}
                  >
                    {item.type === '컨퍼런스' ? '컨퍼런스' : item.type} · {item.organizer}
                  </span>
                ))}
                {cell.events.length > 2 ? (
                  <span
                    className={`block text-[0.625rem] font-semibold ${
                      cell.isSelected ? 'text-ink-fg' : 'text-accent'
                    }`}
                  >
                    +{cell.events.length - 2}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </div>

      <aside className="rounded-lg border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent">
              <SlidersHorizontal className="size-3.5" aria-hidden />
              일정 리스트
            </p>
            <h3 className="mt-1 text-lg font-semibold text-text">
              {selectedDate
                ? selectedDate.replaceAll('-', '.')
                : `${formatMonth(activeMonth)} 전체`}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
            >
              월간 전체
            </button>
            <button
              type="button"
              onClick={() => downloadEventsAsIcs(exportEvents)}
              disabled={exportEvents.length === 0}
              className="rounded-md border border-border bg-bg px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              iCal 내보내기
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {agendaEvents.length ? (
            agendaEvents.map((item) => {
              const eventSources = getSources(item.sourceIds)
              const metadata = getEventScheduleMetadata(item)
              return (
                <article key={item.id} className="rounded-md border border-border bg-bg p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-accent">
                        {formatDateRange(item)} · {item.type}
                      </p>
                      <h4 className="mt-1 text-sm font-semibold leading-5 text-text">
                        {item.title}
                      </h4>
                    </div>
                    <span
                      className={`rounded-md border px-2 py-1 text-[0.6875rem] font-semibold ${statusClass(
                        item.status
                      )}`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[0.6875rem] font-semibold text-text-subtle">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3" aria-hidden />
                      {item.location}
                    </span>
                    {item.timeLabel ? (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" aria-hidden />
                        {item.timeLabel}
                      </span>
                    ) : null}
                    <span>{item.format}</span>
                    <span>{item.language}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-text-muted">{item.summary}</p>
                  <p className="mt-1 text-xs leading-5 text-text-subtle">{item.relevance}</p>
                  <MetadataChips
                    items={[
                      { label: '주최/작성자', value: metadata.authorNames?.join(', ') },
                      { label: '등록일', value: metadata.registeredAt },
                      { label: '시작일', value: metadata.startsAt },
                      { label: '종료일', value: metadata.endsAt },
                      { label: '지역', value: metadata.region },
                      { label: '언어', value: metadata.language },
                      { label: '도메인', value: metadata.sourceDomains?.slice(0, 2).join(', ') },
                      { label: '확인일', value: metadata.lastCheckedAt },
                    ]}
                    limit={8}
                  />
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.tags.slice(0, 5).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-muted transition hover:text-text"
                    >
                      일정 보기
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                    {eventSources.slice(0, 2).map((source) => (
                      <a
                        key={source.id}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-[0.6875rem] font-semibold text-text-muted transition hover:text-text"
                      >
                        {source.publisher}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ))}
                  </div>
                </article>
              )
            })
          ) : (
            <EmptyState
              title="선택한 날짜의 일정이 없습니다"
              body="월간 전체를 누르거나 다른 일정 유형을 선택하세요."
            />
          )}
        </div>
      </aside>
    </div>
  )
}

export function EventPromotionsSection() {
  const eventItems = updates.filter((item) => item.category === 'events')
  const [eventQuery, setEventQuery] = useState('')
  const [eventProviderFiltersActive, setEventProviderFiltersActive] = useState<string[]>([])
  const [eventSortMode, setEventSortMode] = useState<EventPromotionSortMode>('date')
  const [eventSortDirection, setEventSortDirection] = useState<EventPromotionSortDirection>('desc')
  const eventProviderFilters: Array<{ id: string; label: string }> = useMemo(() => {
    const providers = Array.from(new Set(eventItems.map((item) => item.providerId))).sort(
      (left, right) =>
        (getProviderLabel(left) ?? left).localeCompare(getProviderLabel(right) ?? right)
    )
    return [
      { id: 'all', label: '전체' },
      ...providers.map((providerId) => ({
        id: providerId,
        label: getProviderLabel(providerId) ?? providerId,
      })),
    ]
  }, [eventItems])
  const eventSortOptions: Array<{ value: string; label: string }> = [
    { value: 'date-desc', label: '날짜 최신순' },
    { value: 'date-asc', label: '날짜 오래된순' },
    { value: 'title-asc', label: '제목 A→Z' },
    { value: 'title-desc', label: '제목 Z→A' },
    { value: 'provider-asc', label: '제공사 오름차순' },
    { value: 'provider-desc', label: '제공사 내림차순' },
    { value: 'type-asc', label: '이벤트 유형 오름차순' },
    { value: 'type-desc', label: '이벤트 유형 내림차순' },
  ]
  const normalizedEventQuery = eventQuery.trim().toLocaleLowerCase('ko-KR')
  const sortedEventItems = useMemo(() => {
    const direction = eventSortDirection === 'asc' ? 1 : -1
    return eventItems
      .filter(
        (item) =>
          eventProviderFiltersActive.length === 0 ||
          eventProviderFiltersActive.includes(item.providerId)
      )
      .filter((item) => {
        if (!normalizedEventQuery) return true
        const metadata = getUpdateMetadata(item)
        return `${item.title} ${item.summary} ${item.impact} ${item.date} ${item.tags.join(' ')} ${getProviderLabel(item.providerId)} ${getContentMetadataSearchText(metadata)}`
          .toLocaleLowerCase('ko-KR')
          .includes(normalizedEventQuery)
      })
      .toSorted((left, right) => {
        if (eventSortMode === 'date') return left.date.localeCompare(right.date) * direction
        if (eventSortMode === 'title') return left.title.localeCompare(right.title) * direction
        if (eventSortMode === 'provider')
          return (
            (getProviderLabel(left.providerId) ?? '기타').localeCompare(
              getProviderLabel(right.providerId) ?? '기타'
            ) * direction
          )
        return left.tags.join(',').localeCompare(right.tags.join(',')) * direction
      })
  }, [
    eventItems,
    eventProviderFiltersActive,
    eventSortDirection,
    eventSortMode,
    normalizedEventQuery,
  ])

  return (
    <section id="events" className="space-y-4">
      <SectionHeader
        icon={Sparkles}
        title="AI 일정·해커톤·프로모션 워치"
        description="해커톤, 컨퍼런스, 웨비나, 학생/교육 혜택, 크레딧 이벤트를 날짜와 공식 확인 링크 기준으로 추적합니다."
      />
      <EventCalendarBoard />
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1fr_1fr_10rem_8rem]">
        <MultiSegmentBar
          label="제공사"
          items={eventProviderFilters}
          value={eventProviderFiltersActive}
          onChange={setEventProviderFiltersActive}
        />
        <label className="block">
          <span className="text-xs font-semibold text-text-subtle">이벤트 검색</span>
          <input
            value={eventQuery}
            onChange={(event) => setEventQuery(event.target.value)}
            placeholder="OpenAI, Copilot, Gemini, 학생 혜택"
            className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
          />
        </label>
        <SortSelect
          value={`${eventSortMode}-${eventSortDirection}`}
          onChange={(next) => {
            const { mode, direction } = splitSortValue<
              EventPromotionSortMode,
              EventPromotionSortDirection
            >(next)
            setEventSortMode(mode)
            setEventSortDirection(direction)
          }}
          options={eventSortOptions}
        />
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="text-xs font-semibold text-text-subtle">필터 결과</p>
          <p className="mt-1 text-lg font-semibold text-text">{sortedEventItems.length}개</p>
        </div>
      </div>
      {sortedEventItems.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sortedEventItems.map((item) => {
            const eventSources = getSources(item.sourceIds)
            const metadata = getUpdateMetadata(item)
            return (
              <article
                key={item.id}
                className="rounded-lg border border-border border-t-4 border-t-accent bg-surface p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-accent">
                      {getProviderLabel(item.providerId)}
                    </p>
                    <h3 className="mt-1 text-sm font-semibold leading-5 text-text">{item.title}</h3>
                  </div>
                  <span className="rounded-md border border-border bg-bg px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle">
                    확인일 {item.date}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-5 text-text-muted">{item.summary}</p>
                <p className="mt-2 text-xs leading-5 text-text-subtle">{item.impact}</p>
                <MetadataChips
                  items={[
                    { label: '발행일', value: metadata.publishedAt },
                    { label: '등록일', value: metadata.registeredAt },
                    { label: '수정일', value: metadata.modifiedAt },
                    { label: '뉴스 출처', value: metadata.newsSources?.slice(0, 2).join(', ') },
                    { label: '도메인', value: metadata.sourceDomains?.slice(0, 2).join(', ') },
                    { label: '수집일', value: metadata.collectedAt },
                    { label: '확인일', value: metadata.lastCheckedAt },
                  ]}
                  limit={7}
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.tags.slice(0, 4).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-md border border-border bg-bg px-2 py-1 text-[0.6875rem] font-semibold text-text-subtle"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {eventSources.slice(0, 2).map((source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2 py-1 text-[0.6875rem] font-semibold text-text-muted transition hover:text-text"
                    >
                      {source.publisher}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 이벤트가 없습니다"
          body="검색어/제공사를 변경해 더 넓게 보세요."
        />
      )}
    </section>
  )
}
