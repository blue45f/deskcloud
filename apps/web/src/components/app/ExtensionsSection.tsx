import {
  agentExtensions,
  extensionCategories,
  extensionKinds,
  extensionPlatforms,
  getExtensionRankGrade,
  getExtensionSearchText,
  getExtensionStats,
  resolveDirectoryImage,
  type AgentExtension,
  type ExtensionCategory,
  type ExtensionInstallDifficulty,
  type ExtensionKind,
  type ExtensionPlatform,
} from '@aidigestdesk/content'
import {
  Activity,
  BadgeCheck,
  Bot,
  ChevronDown,
  ChevronUp,
  Cpu,
  ExternalLink,
  FileCode2,
  Gauge,
  LayoutPanelTop,
  Layers3,
  Medal,
  Monitor,
  PackageCheck,
  Puzzle,
  Server,
  Terminal,
  Wand2,
  Webhook,
  Workflow,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type { ComponentType } from 'react'

import {
  ActiveFilterChips,
  Chip,
  EmptyState,
  ResultSummary,
  SearchField,
  SectionHeader,
  SegmentBar,
  SortSelect,
  Thumbnail,
  type ChipTone,
} from '@/components/app/CommonUi'

type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>

type KindFilter = ExtensionKind | 'all'
type PlatformFilter = ExtensionPlatform | 'all'
type CategoryFilter = ExtensionCategory | 'all'
type DifficultyFilter = ExtensionInstallDifficulty | 'all'
type SortMode = 'rank' | 'name-asc' | 'name-desc' | 'kind' | 'platform' | 'difficulty'
type FocusFilter = 'all' | 'install' | 'skills' | 'evals' | 'runtime' | 'ui' | 'frameworks'

/** 종류 → lucide 아이콘. 카드의 시각적 분류 신호. */
const kindIcons: Record<ExtensionKind, IconComponent> = {
  플러그인: Puzzle,
  훅: Webhook,
  스킬: Wand2,
  '슬래시 명령': Terminal,
  서브에이전트: Bot,
  'MCP 서버': Server,
  하네스: Gauge,
  위젯: LayoutPanelTop,
  '로컬 모델 UI': Monitor,
  '모델 런타임': Cpu,
  워크플로우: Workflow,
  '룰셋/지침': FileCode2,
  템플릿: FileCode2,
}

/** 종류 → 칩 톤(종류 계열별 색). 그 외는 neutral. */
const kindTones: Partial<Record<ExtensionKind, ChipTone>> = {
  'MCP 서버': 'blue',
  훅: 'amber',
  스킬: 'accent',
  하네스: 'blue',
  위젯: 'coral',
  '로컬 모델 UI': 'accent',
  '모델 런타임': 'amber',
  워크플로우: 'coral',
}

const difficultyFilterItems: Array<{ id: DifficultyFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '쉬움', label: '쉬움' },
  { id: '보통', label: '보통' },
  { id: '고급', label: '고급' },
]

const kindFilterItems: Array<{ id: KindFilter; label: string }> = [
  { id: 'all', label: '전체' },
  ...extensionKinds.map((kind) => ({ id: kind, label: kind })),
]

const platformFilterItems: Array<{ id: PlatformFilter; label: string }> = [
  { id: 'all', label: '전체' },
  ...extensionPlatforms.map((platform) => ({ id: platform, label: platform })),
]

const categoryFilterItems: Array<{ id: CategoryFilter; label: string }> = [
  { id: 'all', label: '전체' },
  ...extensionCategories.map((category) => ({ id: category, label: category })),
]

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: 'rank', label: '추천 순위' },
  { value: 'name-asc', label: '이름 A→Z' },
  { value: 'name-desc', label: '이름 Z→A' },
  { value: 'kind', label: '유형별' },
  { value: 'platform', label: '플랫폼별' },
  { value: 'difficulty', label: '설치 난이도' },
]

const difficultyOrder: Record<ExtensionInstallDifficulty, number> = {
  쉬움: 0,
  보통: 1,
  고급: 2,
}

const initialVisibleCount = 18

const focusPresets: Array<{
  id: FocusFilter
  label: string
  description: string
  icon: IconComponent
}> = [
  {
    id: 'all',
    label: '전체',
    description: '필터 없이 전체 디렉터리',
    icon: PackageCheck,
  },
  {
    id: 'install',
    label: '설치·스킬',
    description: '플러그인, 훅, 스킬, MCP',
    icon: Puzzle,
  },
  {
    id: 'skills',
    label: '스킬',
    description: 'SKILL.md와 agent skills',
    icon: Wand2,
  },
  {
    id: 'evals',
    label: '하네스',
    description: '평가, 회귀 테스트, 벤치마크',
    icon: Gauge,
  },
  {
    id: 'runtime',
    label: '모델·서빙',
    description: '로컬 UI와 inference 런타임',
    icon: Cpu,
  },
  {
    id: 'ui',
    label: '위젯·화면',
    description: 'Chat UI, 앱 위젯, agent UI',
    icon: LayoutPanelTop,
  },
  {
    id: 'frameworks',
    label: '프레임워크',
    description: 'agent workflow와 orchestration',
    icon: Layers3,
  },
]

const gradeTones = {
  S: 'accent',
  A: 'blue',
  B: 'amber',
  C: 'neutral',
  미분류: 'neutral',
} satisfies Record<ReturnType<typeof getExtensionRankGrade>, ChipTone>

function getRankValue(extension: AgentExtension) {
  return extension.rank ?? Number.POSITIVE_INFINITY
}

function compareByRank(a: AgentExtension, b: AgentExtension) {
  return getRankValue(a) - getRankValue(b) || a.name.localeCompare(b.name, 'ko-KR')
}

function compareExtensions(a: AgentExtension, b: AgentExtension, sort: SortMode): number {
  switch (sort) {
    case 'rank':
      return compareByRank(a, b)
    case 'name-desc':
      return b.name.localeCompare(a.name, 'ko-KR')
    case 'kind':
      return a.kind.localeCompare(b.kind, 'ko-KR') || a.name.localeCompare(b.name, 'ko-KR')
    case 'platform':
      return a.platform.localeCompare(b.platform, 'ko-KR') || a.name.localeCompare(b.name, 'ko-KR')
    case 'difficulty':
      return extensionDifficultyRank(a) - extensionDifficultyRank(b) || compareByRank(a, b)
    case 'name-asc':
    default:
      return a.name.localeCompare(b.name, 'ko-KR')
  }
}

function extensionDifficultyRank(extension: AgentExtension) {
  return extension.installDifficulty ? difficultyOrder[extension.installDifficulty] : 99
}

function matchesFocusPreset(extension: AgentExtension, focus: FocusFilter) {
  switch (focus) {
    case 'install':
      return ['플러그인', '훅', '스킬', '슬래시 명령', 'MCP 서버'].includes(extension.kind)
    case 'skills':
      return extension.kind === '스킬' || extension.tags.some((tag) => /skill/i.test(tag))
    case 'evals':
      return extension.kind === '하네스' || extension.category === '평가/하네스'
    case 'runtime':
      return ['로컬 모델 UI', '모델 런타임'].includes(extension.kind) || extension.category === '모델 서빙'
    case 'ui':
      return extension.kind === '위젯' || extension.category === '에이전트 UI'
    case 'frameworks':
      return extension.kind === '워크플로우' || extension.tags.some((tag) => /agent|framework|workflow/i.test(tag))
    case 'all':
    default:
      return true
  }
}

function CodeRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[0.6875rem] font-semibold text-text-subtle">{label}</p>
      <code className="block break-words rounded bg-surface-2 px-2 py-1 font-mono text-xs text-text-muted">
        {value}
      </code>
    </div>
  )
}

function ExtensionCard({ extension }: { extension: AgentExtension }) {
  const KindIcon = kindIcons[extension.kind]
  const kindTone = kindTones[extension.kind] ?? 'neutral'
  const image = resolveDirectoryImage(extension)
  const grade = getExtensionRankGrade(extension)

  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="w-16 shrink-0">
          <Thumbnail
            src={image?.src}
            alt={`${extension.name} 썸네일`}
            ratio={image?.ratio ?? 'square'}
            icon={KindIcon}
            caption={extension.kind}
            fit={extension.thumbnailFit ?? 'contain'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="min-w-0 text-sm font-semibold text-text">{extension.name}</h3>
          {extension.rankReason ? (
            <p className="mt-1 line-clamp-2 text-[0.6875rem] leading-4 text-text-subtle">
              {extension.rankReason}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {extension.rank ? (
          <Chip tone={gradeTones[grade]} icon={Medal}>
            #{extension.rank} · {grade}
          </Chip>
        ) : null}
        <Chip tone={kindTone} icon={KindIcon}>
          {extension.kind}
        </Chip>
        <Chip tone="neutral">{extension.platform}</Chip>
        <Chip tone="neutral">{extension.category}</Chip>
        <Chip tone={extension.maturity === '공식' ? 'accent' : 'neutral'}>
          {extension.maturity}
        </Chip>
        {extension.installDifficulty ? (
          <Chip tone="neutral" icon={PackageCheck}>
            설치 {extension.installDifficulty}
          </Chip>
        ) : null}
      </div>

      <p className="mt-3 text-xs leading-5 text-text-muted">{extension.summary}</p>

      {extension.whatItDoes.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {extension.whatItDoes.slice(0, 3).map((item) => (
            <li key={item} className="flex gap-2 text-xs leading-5 text-text-muted">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-3 space-y-2">
        <CodeRow label="설치" value={extension.install} />
        <CodeRow label="사용" value={extension.usage} />
      </div>

      {extension.installSteps?.length ? (
        <div className="mt-3 rounded-md border border-border bg-bg px-3 py-2">
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold text-text-subtle">
            <BadgeCheck className="size-3.5" aria-hidden />
            설치 순서
          </p>
          <ol className="mt-2 space-y-1.5 text-xs leading-5 text-text-muted">
            {extension.installSteps.slice(0, 3).map((step, index) => (
              <li key={step} className="flex gap-2">
                <span className="font-semibold text-text-subtle">{index + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {extension.bestFor?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {extension.bestFor.slice(0, 4).map((item) => (
            <Chip key={item} tone="neutral" icon={Activity}>
              {item}
            </Chip>
          ))}
        </div>
      ) : null}

      {extension.adoptionSignal ? (
        <p className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs leading-5 text-text-subtle">
          <span className="font-semibold text-text-muted">신뢰 신호 · </span>
          {extension.adoptionSignal}
        </p>
      ) : null}

      {extension.koreanNote ? (
        <div className="mt-3 rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-xs leading-5 text-accent">
          <span className="font-semibold">국내 팁 · </span>
          {extension.koreanNote}
        </div>
      ) : null}

      <a
        href={extension.url}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 self-start text-xs font-semibold text-text-muted transition hover:text-text"
      >
        <ExternalLink className="size-3.5" aria-hidden />
        문서 열기
      </a>
    </article>
  )
}

export function ExtensionsSection() {
  const [query, setQuery] = useState('')
  const [focus, setFocus] = useState<FocusFilter>('all')
  const [kind, setKind] = useState<KindFilter>('all')
  const [platform, setPlatform] = useState<PlatformFilter>('all')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [difficulty, setDifficulty] = useState<DifficultyFilter>('all')
  const [sort, setSort] = useState<SortMode>('rank')
  const filterKey = `${query}\u0000${focus}\u0000${kind}\u0000${platform}\u0000${category}\u0000${difficulty}\u0000${sort}`
  const [visibleLimitState, setVisibleLimitState] = useState({
    key: filterKey,
    limit: initialVisibleCount,
  })

  const stats = getExtensionStats()
  const focusCounts = useMemo(
    () =>
      Object.fromEntries(
        focusPresets.map((preset) => [
          preset.id,
          agentExtensions.filter((extension) => matchesFocusPreset(extension, preset.id)).length,
        ])
      ) as Record<FocusFilter, number>,
    []
  )
  const rankedHighlights = useMemo(
    () =>
      agentExtensions
        .filter((extension) => extension.rank)
        .sort(compareByRank)
        .slice(0, 6),
    []
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('ko-KR')
    return agentExtensions
      .filter((extension) => {
        if (!matchesFocusPreset(extension, focus)) return false
        if (kind !== 'all' && extension.kind !== kind) return false
        if (platform !== 'all' && extension.platform !== platform) return false
        if (category !== 'all' && extension.category !== category) return false
        if (difficulty !== 'all' && extension.installDifficulty !== difficulty) return false
        if (
          needle &&
          !getExtensionSearchText(extension).toLocaleLowerCase('ko-KR').includes(needle)
        )
          return false
        return true
      })
      .sort((a, b) => compareExtensions(a, b, sort))
  }, [query, focus, kind, platform, category, difficulty, sort])

  const visibleLimit =
    visibleLimitState.key === filterKey ? visibleLimitState.limit : initialVisibleCount
  const visibleExtensions = filtered.slice(0, visibleLimit)
  const hasMore = visibleExtensions.length < filtered.length

  const setVisibleLimitForCurrentFilter = (nextLimit: number) => {
    setVisibleLimitState({ key: filterKey, limit: nextLimit })
  }

  const hasActiveFilter =
    query.trim() !== '' ||
    focus !== 'all' ||
    kind !== 'all' ||
    platform !== 'all' ||
    category !== 'all' ||
    difficulty !== 'all'

  const resetAll = () => {
    setQuery('')
    setFocus('all')
    setKind('all')
    setPlatform('all')
    setCategory('all')
    setDifficulty('all')
  }

  const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
  if (focus !== 'all') {
    const preset = focusPresets.find((item) => item.id === focus)
    chips.push({
      key: 'focus',
      label: `탐색 · ${preset?.label ?? focus}`,
      onRemove: () => setFocus('all'),
    })
  }
  if (kind !== 'all')
    chips.push({ key: 'kind', label: `종류 · ${kind}`, onRemove: () => setKind('all') })
  if (platform !== 'all')
    chips.push({
      key: 'platform',
      label: `플랫폼 · ${platform}`,
      onRemove: () => setPlatform('all'),
    })
  if (category !== 'all')
    chips.push({
      key: 'category',
      label: `카테고리 · ${category}`,
      onRemove: () => setCategory('all'),
    })
  if (difficulty !== 'all')
    chips.push({
      key: 'difficulty',
      label: `난이도 · ${difficulty}`,
      onRemove: () => setDifficulty('all'),
    })
  if (query.trim() !== '')
    chips.push({ key: 'query', label: `검색 · ${query.trim()}`, onRemove: () => setQuery('') })

  return (
    <section id="extensions" className="space-y-4">
      <SectionHeader
        icon={Puzzle}
        title="AI 코딩 에이전트 확장 디렉터리"
        description="플러그인·훅·스킬·MCP·하네스·위젯·로컬 모델 UI를 플랫폼과 도메인 카테고리로 세분화해 검색합니다. 추천 순위, S/A/B/C 등급, 설치 난이도, 설치 순서와 썸네일을 함께 제공합니다."
        badge={
          <Chip tone="blue">
            {stats.total}개 · 추천순위 {stats.ranked}개
          </Chip>
        }
      />

      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">
              최신 추천 Top 6
            </p>
            <p className="mt-1 text-xs text-text-muted">
              공식 문서 확인일과 설치 난이도를 함께 본 편집자 순위입니다.
            </p>
          </div>
          <Chip tone="accent" icon={Medal}>
            S/A/B/C
          </Chip>
        </div>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {rankedHighlights.map((extension) => {
            const grade = getExtensionRankGrade(extension)
            const KindIcon = kindIcons[extension.kind]
            return (
              <button
                key={extension.id}
                type="button"
                onClick={() => {
                  setQuery(extension.name)
                  setSort('rank')
                }}
                className="flex min-h-20 items-start gap-3 rounded-md border border-border bg-bg p-3 text-left transition hover:border-accent/50 hover:bg-accent/5"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-surface text-text-muted">
                  <KindIcon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={gradeTones[grade]} icon={Medal}>
                      #{extension.rank} · {grade}
                    </Chip>
                    {extension.installDifficulty ? (
                      <Chip tone="neutral">설치 {extension.installDifficulty}</Chip>
                    ) : null}
                  </span>
                  <span className="mt-2 block truncate text-xs font-semibold text-text">
                    {extension.name}
                  </span>
                  <span className="mt-1 block line-clamp-2 text-[0.6875rem] leading-4 text-text-muted">
                    {extension.rankReason ?? extension.summary}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {focusPresets.map((preset) => {
          const PresetIcon = preset.icon
          const selected = preset.id === focus
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                setFocus(preset.id)
                setSort('rank')
                setVisibleLimitForCurrentFilter(initialVisibleCount)
              }}
              className={`min-h-24 rounded-lg border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                selected
                  ? 'border-accent/60 bg-accent/10 text-text'
                  : 'border-border bg-surface text-text-muted hover:border-border-strong hover:text-text'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="grid size-8 place-items-center rounded-md border border-border bg-bg">
                  <PresetIcon className="size-4" aria-hidden />
                </span>
                <Chip tone={selected ? 'accent' : 'neutral'}>{focusCounts[preset.id]}개</Chip>
              </span>
              <span className="mt-3 block text-xs font-semibold text-text">{preset.label}</span>
              <span className="mt-1 block text-[0.6875rem] leading-4 text-text-muted">
                {preset.description}
              </span>
            </button>
          )
        })}
      </div>

      <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <SearchField
            label="검색"
            value={query}
            onChange={setQuery}
            placeholder="이름, 요약, 태그, 설치/사용 명령으로 검색"
          />
          <SortSelect label="정렬" value={sort} onChange={setSort} options={sortOptions} />
        </div>

        <SegmentBar label="종류" items={kindFilterItems} value={kind} onChange={setKind} />
        <SegmentBar
          label="플랫폼"
          items={platformFilterItems}
          value={platform}
          onChange={setPlatform}
        />
        <SegmentBar
          label="카테고리"
          items={categoryFilterItems}
          value={category}
          onChange={setCategory}
        />
        <SegmentBar
          label="설치 난이도"
          items={difficultyFilterItems}
          value={difficulty}
          onChange={setDifficulty}
        />

        <ResultSummary
          shown={visibleExtensions.length}
          total={stats.total}
          onReset={resetAll}
          resetDisabled={!hasActiveFilter}
        />
        {filtered.length > visibleExtensions.length ? (
          <p className="text-xs leading-5 text-text-subtle">
            현재 조건 {filtered.length}개 중 {visibleExtensions.length}개만 먼저 표시합니다. 필요한
            항목은 검색·필터로 좁히거나 더 보기를 사용하세요.
          </p>
        ) : null}
      </div>

      {chips.length > 0 ? <ActiveFilterChips chips={chips} /> : null}

      {filtered.length > 0 ? (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {visibleExtensions.map((extension) => (
              <ExtensionCard key={extension.id} extension={extension} />
            ))}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            {hasMore ? (
              <button
                type="button"
                onClick={() =>
                  setVisibleLimitForCurrentFilter(Math.min(visibleLimit + 18, filtered.length))
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
              >
                <ChevronDown className="size-3.5" aria-hidden />더 보기 ·{' '}
                {filtered.length - visibleExtensions.length}개 남음
              </button>
            ) : filtered.length > initialVisibleCount ? (
              <button
                type="button"
                onClick={() => setVisibleLimitForCurrentFilter(initialVisibleCount)}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
              >
                <ChevronUp className="size-3.5" aria-hidden />
                처음 {initialVisibleCount}개만 보기
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <EmptyState title="조건에 맞는 확장이 없습니다" body="필터를 줄이거나 검색어를 지우세요." />
      )}
    </section>
  )
}
