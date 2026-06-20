import {
  getDealStats,
  getDealStatus,
  getDomainFromUrl,
  isRecent,
  llmDeals,
  SNAPSHOT_DATE,
  sortDeals,
  type DealSortMode,
  type DealType,
  type LlmDeal,
  type ProviderId,
} from '@aidigestdesk/content'
import { BadgePercent, Clock, ExternalLink, MapPin } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  ActiveFilterChips,
  Chip,
  type ChipTone,
  BrandMark,
  EmptyState,
  NewBadge,
  ResultSummary,
  SearchField,
  SectionHeader,
  SegmentBar,
  SortSelect,
} from '@/components/app/CommonUi'

/** 실제 ProviderId 집합. provider 가 'market' 인 항목은 도메인 폴백을 쓴다. */
const PROVIDER_IDS = new Set<ProviderId>([
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

function isProviderId(value: LlmDeal['provider']): value is ProviderId {
  return value !== 'market' && PROVIDER_IDS.has(value)
}

const DEAL_TYPES: DealType[] = [
  '정부지원사업',
  '국내 혜택',
  '학생/교육',
  '무료 크레딧',
  'API 가격 인하',
  '배치/캐싱 절감',
  '구독 할인',
]

const typeFilterItems: Array<{ id: string; label: string }> = [
  { id: 'all', label: '전체' },
  ...DEAL_TYPES.map((type) => ({ id: type, label: type })),
]

type RegionFilter = '전체' | '국내' | '글로벌' | '북미' | '아시아'

const regionFilterItems: Array<{ id: RegionFilter; label: string }> = [
  { id: '전체', label: '전체' },
  { id: '국내', label: '국내' },
  { id: '글로벌', label: '글로벌' },
  { id: '북미', label: '북미' },
  { id: '아시아', label: '아시아' },
]

type AudienceFilter = '전체' | '학생' | '개인' | '팀/조직' | '스타트업'

const audienceFilterItems: Array<{ id: AudienceFilter; label: string }> = [
  { id: '전체', label: '전체' },
  { id: '학생', label: '학생' },
  { id: '개인', label: '개인' },
  { id: '팀/조직', label: '팀/조직' },
  { id: '스타트업', label: '스타트업' },
]

const sortOptions: Array<{ value: DealSortMode; label: string }> = [
  { value: 'recommended', label: '추천순 (국내 우선)' },
  { value: 'type', label: '유형별' },
  { value: 'provider', label: '제공사' },
  { value: 'verified', label: '확인일 최신순' },
]

/** dealType → 할인 배지 톤. 국내 혜택과 무료 크레딧을 가장 강조한다. */
const dealTypeTone: Record<DealType, ChipTone> = {
  정부지원사업: 'blue',
  '국내 혜택': 'accent',
  '학생/교육': 'blue',
  '무료 크레딧': 'accent',
  'API 가격 인하': 'amber',
  '배치/캐싱 절감': 'amber',
  '구독 할인': 'coral',
}

const statusTone: Record<string, ChipTone> = {
  상시: 'accent',
  진행중: 'blue',
  진행예정: 'amber',
  종료: 'neutral',
}

function LabeledRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-xs leading-5">
      <span className="shrink-0 font-semibold text-text-subtle">{label}</span>
      <span className="text-text-muted">{value}</span>
    </div>
  )
}

function DealCard({ deal }: { deal: LlmDeal }) {
  const status = getDealStatus(deal, SNAPSHOT_DATE)
  const providerId = isProviderId(deal.provider) ? deal.provider : undefined
  const domain = providerId ? undefined : getDomainFromUrl(deal.url)

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <BrandMark providerId={providerId} domain={domain} label={deal.providerName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-text-subtle">{deal.providerName}</span>
            {isRecent(deal.lastVerified) ? <NewBadge /> : null}
          </div>
          <h3 className="mt-0.5 text-sm font-semibold leading-5 text-text">{deal.title}</h3>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone={dealTypeTone[deal.dealType]} icon={BadgePercent}>
          {deal.discountLabel}
        </Chip>
        <Chip tone={statusTone[status] ?? 'neutral'} icon={Clock}>
          {status}
        </Chip>
        <Chip tone="neutral" icon={MapPin}>
          {deal.region}
        </Chip>
        <Chip tone="neutral">{deal.dealType}</Chip>
      </div>

      <p className="text-sm leading-6 text-text-muted">{deal.summary}</p>

      <div className="space-y-1.5">
        <LabeledRow label="자격" value={deal.eligibility} />
        <LabeledRow label="신청" value={deal.howToClaim} />
      </div>

      {deal.koreanNote ? (
        <div className="flex gap-2 rounded-md border border-accent/30 bg-accent/10 px-3 py-2">
          <span className="shrink-0 text-[0.6875rem] font-bold text-accent">국내 팁</span>
          <span className="text-xs leading-5 text-text-muted">{deal.koreanNote}</span>
        </div>
      ) : null}

      {deal.tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {deal.tags.map((tag) => (
            <Chip key={tag} tone="neutral">
              {tag}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="text-[0.6875rem] font-medium text-text-subtle">
          확인일 {deal.lastVerified}
        </span>
        <a
          href={deal.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
        >
          혜택 확인
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </article>
  )
}

export function DealsSection({ deals = llmDeals }: { deals?: LlmDeal[] }) {
  const [dealType, setDealType] = useState('all')
  const [region, setRegion] = useState<RegionFilter>('전체')
  const [audience, setAudience] = useState<AudienceFilter>('전체')
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<DealSortMode>('recommended')

  const stats = getDealStats()

  const visibleDeals = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    const filtered = deals.filter((deal) => {
      if (dealType !== 'all' && deal.dealType !== dealType) return false
      if (region !== '전체' && deal.region !== region) return false
      if (audience !== '전체' && deal.audience !== audience) return false
      if (trimmed) {
        const haystack = [deal.title, deal.summary, deal.providerName, ...deal.tags]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(trimmed)) return false
      }
      return true
    })
    return sortDeals(filtered, sortMode, sortMode === 'verified' ? 'desc' : 'asc')
  }, [deals, dealType, region, audience, query, sortMode])

  const domesticOnly = region === '국내'

  const resetFilters = () => {
    setDealType('all')
    setRegion('전체')
    setAudience('전체')
    setQuery('')
    setSortMode('recommended')
  }

  const isDefault =
    dealType === 'all' &&
    region === '전체' &&
    audience === '전체' &&
    query.trim() === '' &&
    sortMode === 'recommended'

  const activeChips = [
    dealType !== 'all'
      ? { key: 'type', label: `유형: ${dealType}`, onRemove: () => setDealType('all') }
      : null,
    region !== '전체'
      ? { key: 'region', label: `지역: ${region}`, onRemove: () => setRegion('전체') }
      : null,
    audience !== '전체'
      ? { key: 'audience', label: `대상: ${audience}`, onRemove: () => setAudience('전체') }
      : null,
    query.trim()
      ? { key: 'query', label: `검색: ${query.trim()}`, onRemove: () => setQuery('') }
      : null,
  ].filter((chip): chip is { key: string; label: string; onRemove: () => void } => chip !== null)

  return (
    <section id="deals" className="space-y-4">
      <SectionHeader
        icon={BadgePercent}
        title="LLM 할인·혜택"
        description="상용 LLM의 학생/교육 혜택, 무료 크레딧, API 가격 인하, 배치·캐싱 절감, 국내 전용 프로모션을 모았습니다. 국내 적용 방법과 확인 링크를 함께 제공합니다."
        badge={<Chip tone="accent">국내 {stats.domestic}건</Chip>}
      />

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr]">
          <SegmentBar label="유형" items={typeFilterItems} value={dealType} onChange={setDealType} />
          <SegmentBar
            label="지역"
            items={regionFilterItems}
            value={region}
            onChange={setRegion}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr]">
          <SegmentBar
            label="대상"
            items={audienceFilterItems}
            value={audience}
            onChange={setAudience}
          />
          <div className="flex flex-col justify-end">
            <p className="mb-2 text-xs font-semibold text-text-subtle">빠른 필터</p>
            <button
              type="button"
              aria-pressed={domesticOnly}
              onClick={() => setRegion(domesticOnly ? '전체' : '국내')}
              className={
                domesticOnly
                  ? 'inline-flex w-fit items-center gap-1.5 rounded-md border border-accent bg-accent/15 px-3 py-1.5 text-xs font-semibold text-accent'
                  : 'inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text'
              }
            >
              <MapPin className="size-3.5" aria-hidden />
              국내 혜택만
            </button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_minmax(12rem,auto)]">
          <SearchField
            label="검색"
            value={query}
            onChange={setQuery}
            placeholder="제목, 요약, 제공사, 태그"
          />
          <SortSelect value={sortMode} onChange={setSortMode} options={sortOptions} />
        </div>

        {activeChips.length ? <ActiveFilterChips chips={activeChips} /> : null}

        <ResultSummary
          shown={visibleDeals.length}
          total={deals.length}
          unit="건"
          onReset={resetFilters}
          resetDisabled={isDefault}
        />
      </div>

      {visibleDeals.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visibleDeals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 혜택이 없습니다"
          body="유형·지역·대상 필터를 줄이거나 검색어를 지우면 더 많은 혜택을 볼 수 있습니다."
        />
      )}
    </section>
  )
}
