import {
  getProviderLabel,
  getSources,
  llmCliManuals,
  providerCatalog,
  vibeCodingCommands,
  type LlmCliManual,
  type ProviderId,
  type VibeCodingCommand,
} from '@aidigestdesk/content'
import {
  BookOpenCheck,
  ChevronDown,
  CheckCircle2,
  Copy,
  ExternalLink,
  GitBranch,
  KeyRound,
  ShieldCheck,
  Terminal,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  BrandMark,
  Chip,
  EmptyState,
  MetadataChips,
  ResultSummary,
  SearchField,
  SectionHeader,
  MultiSegmentBar,
  SegmentBar,
  SortSelect,
  TextList,
  type ChipTone,
} from '@/components/app/CommonUi'

type SurfaceFilter = VibeCodingCommand['surface'] | 'all'
type SortMode = 'fit' | 'model' | 'provider'
type ManualLevelFilter = LlmCliManual['level'] | 'all'
type ManualSortMode = 'recommended' | 'level' | 'title' | 'source'
type ActiveManualLevelFilter = Exclude<ManualLevelFilter, 'all'>

/** 적합도 칩 톤 매핑 — CommonUi.Chip 톤 어휘에 맞춘다. */
const fitToneMap: Record<VibeCodingCommand['vibeCodingFit'], ChipTone> = {
  '매우 높음': 'accent',
  높음: 'blue',
  보통: 'neutral',
  제한적: 'amber',
}

/** 적합도 정렬용 가중치(높을수록 앞). */
const fitOrderMap: Record<VibeCodingCommand['vibeCodingFit'], number> = {
  '매우 높음': 3,
  높음: 2,
  보통: 1,
  제한적: 0,
}

const surfaceFilters: Array<{ id: SurfaceFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '전용 CLI', label: '전용 CLI' },
  { id: 'IDE/에이전트', label: 'IDE/에이전트' },
  { id: 'OpenAI 호환 API', label: '호환 API' },
  { id: '공식 SDK', label: '공식 SDK' },
  { id: '서드파티 CLI', label: '서드파티 CLI' },
  { id: '웹/에이전트', label: '웹/에이전트' },
]

const sortOptions: Array<{ value: SortMode; label: string }> = [
  { value: 'fit', label: '적합도순' },
  { value: 'model', label: '모델명 A→Z' },
  { value: 'provider', label: '제공사' },
]

const manualLevelFilters: Array<{ id: ManualLevelFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: '입문', label: '입문' },
  { id: '실무', label: '실무' },
  { id: '고급', label: '고급' },
]

const manualSortOptions: Array<{ value: ManualSortMode; label: string }> = [
  { value: 'recommended', label: '추천 흐름순' },
  { value: 'level', label: '난이도순' },
  { value: 'title', label: '제목 A→Z' },
  { value: 'source', label: '출처 많은 순' },
]

const manualLevelOrderMap: Record<LlmCliManual['level'], number> = {
  입문: 0,
  실무: 1,
  고급: 2,
}

const recommendedManualIds = [
  'llm-cli-quickstart',
  'llm-cli-plugin-skill-installation',
  'llm-cli-model-router-observability',
  'llm-cli-eval-harness-playbook',
  'llm-cli-local-model-ui-stack',
  'llm-cli-glm-local-serving',
] as const

const recommendedManualRankMap: Map<string, number> = new Map(
  recommendedManualIds.map((manualId, index) => [manualId, index])
)

const initialManualVisibleCount = 6

const manualProviderItems: Array<{ id: ProviderId | 'all'; label: string }> = [
  { id: 'all', label: '전체' },
  ...providerCatalog.map((provider) => ({
    id: provider.id,
    label: provider.shortLabel,
  })),
]

const commandById = new Map(vibeCodingCommands.map((command) => [command.id, command]))

function getRecommendedManualRank(manualId: string) {
  const curatedRank = recommendedManualRankMap.get(manualId)
  if (curatedRank !== undefined) return curatedRank

  const sourceRank = llmCliManuals.findIndex((manual) => manual.id === manualId)
  return recommendedManualIds.length + (sourceRank === -1 ? llmCliManuals.length : sourceRank)
}

/** 클립보드 복사. navigator.clipboard 부재 환경에서도 조용히 실패 상태만 돌려준다. */
async function copyCommand(text: string) {
  try {
    await navigator.clipboard?.writeText(text)
    return true
  } catch {
    return false
  }
}

/** 라벨이 달린 모노스페이스 명령어 행. 카드 간 비교를 위해 일관된 형태를 유지한다. */
function CommandRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    },
    []
  )

  const handleCopy = async () => {
    const didCopy = await copyCommand(value)
    if (!didCopy) return
    setCopied(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="min-w-0 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-text-subtle">{label}</span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          title={`${label} 명령어 복사`}
          aria-label={`${label} 명령어 복사`}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-0.5 text-[0.6875rem] font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
        >
          <Copy className="size-3" aria-hidden />
          {copied ? '복사됨' : '복사'}
        </button>
      </div>
      <code className="block w-full max-w-full overflow-x-auto whitespace-pre rounded bg-surface-2 px-2 py-1 font-mono text-xs text-text">
        {value}
      </code>
    </div>
  )
}

function CommandCard({ command }: { command: VibeCodingCommand }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const sourceUrl = getSources(command.sourceIds)[0]?.url ?? null
  const visibleNotes = notesOpen ? command.setupNotes : command.setupNotes.slice(0, 3)
  const hasMoreNotes = command.setupNotes.length > 3

  return (
    <article className="min-w-0 space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <BrandMark providerId={command.providerId} label={command.modelName} size="sm" />
        <h3 className="min-w-0 flex-1 text-sm font-bold text-text">{command.modelName}</h3>
        <Chip tone="neutral">{command.surface}</Chip>
        <Chip tone={fitToneMap[command.vibeCodingFit]}>{command.vibeCodingFit}</Chip>
      </div>

      <p className="text-sm leading-6 text-text-muted">{command.useCase}</p>

      <div className="space-y-2.5">
        <CommandRow label="설치" value={command.installCommand} />
        <CommandRow label="실행" value={command.command} />
      </div>

      {command.goal ? (
        <p className="text-xs leading-5 text-text-muted">
          <span className="font-semibold text-text-subtle">목표</span> · {command.goal}
        </p>
      ) : null}
      {command.loop ? (
        <p className="text-xs leading-5 text-text-muted">
          <span className="font-semibold text-text-subtle">작업 루프</span> · {command.loop}
        </p>
      ) : null}

      {command.setupNotes.length ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-text-subtle">셋업 포인트</p>
          <ul className="space-y-1">
            {visibleNotes.map((note) => (
              <li key={note} className="flex gap-1.5 text-xs leading-5 text-text-muted">
                <span className="mt-0.5 shrink-0 text-accent" aria-hidden>
                  ·
                </span>
                <span>{note}</span>
              </li>
            ))}
          </ul>
          {hasMoreNotes ? (
            <button
              type="button"
              onClick={() => setNotesOpen((open) => !open)}
              aria-expanded={notesOpen}
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:text-text"
            >
              {notesOpen ? '접기' : `${command.setupNotes.length - 3}개 더 보기`}
              <ChevronDown
                className={`size-3 transition ${notesOpen ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
      ) : null}

      {command.caveats.length ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-text-subtle">주의점</p>
          <ul className="space-y-1">
            {command.caveats.map((caveat) => (
              <li
                key={caveat}
                className="rounded border border-accent-3/30 bg-accent-3/10 px-2 py-1 text-xs leading-5 text-accent-3"
              >
                {caveat}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sourceUrl ? (
        <a
          href={sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
        >
          출처
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
    </article>
  )
}

function ManualOverviewPanel({ manuals }: { manuals: LlmCliManual[] }) {
  const linkedCommandCount = new Set(manuals.flatMap((manual) => manual.commandIds)).size
  const coveredProviderLabels = [
    ...new Set(
      manuals.flatMap((manual) =>
        manual.providerIds.map((providerId) => getProviderLabel(providerId) ?? providerId)
      )
    ),
  ]

  const panels = [
    {
      icon: Terminal,
      title: '시작 순서',
      body: '처음에는 전용 CLI 빠른 시작으로 설치와 읽기 전용 점검을 끝내고, 그 다음 버그 수정 루프나 Aider 비교로 넘어갑니다.',
    },
    {
      icon: GitBranch,
      title: '실전 범위',
      body: `${linkedCommandCount}개 명령어 흐름과 연결되어 repo 수정, PR 리뷰, OpenAI 호환 API, 로컬 모델, 팀 도입까지 이어집니다.`,
    },
    {
      icon: KeyRound,
      title: '운영 기준',
      body: 'API 키, base URL, 권한 모드, MCP, 검증 명령을 같은 매뉴얼 안에서 확인하도록 구성했습니다.',
    },
    {
      icon: ShieldCheck,
      title: '커버리지',
      body: coveredProviderLabels.length
        ? coveredProviderLabels.slice(0, 7).join(' · ')
        : '현재 필터에 맞는 제공사가 없습니다.',
    },
  ]

  return (
    <div className="grid gap-3 lg:grid-cols-4">
      {panels.map((panel) => (
        <article key={panel.title} className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-bg text-accent">
              <panel.icon className="size-4" aria-hidden />
            </span>
            <h3 className="text-sm font-semibold text-text">{panel.title}</h3>
          </div>
          <p className="mt-3 text-xs leading-5 text-text-muted">{panel.body}</p>
        </article>
      ))}
    </div>
  )
}

function ManualSourceLinks({ manual }: { manual: LlmCliManual }) {
  const sources = getSources(manual.sourceIds)
  const sourceDomains = [
    ...new Set(
      sources.flatMap((source) => {
        try {
          return new URL(source.url).hostname.replace(/^www\./, '')
        } catch {
          return []
        }
      })
    ),
  ]
  const lastChecked = sources
    .map((source) => source.lastChecked)
    .toSorted((left, right) => right.localeCompare(left))[0]

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-text-subtle">근거 문서</p>
      <div className="flex flex-wrap gap-2">
        {sources.slice(0, 5).map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
          >
            {source.publisher}
            <ExternalLink className="size-3" aria-hidden />
          </a>
        ))}
      </div>
      <MetadataChips
        items={[
          { label: '출처', value: sources.map((source) => source.publisher).join(', ') },
          { label: '도메인', value: sourceDomains.slice(0, 4).join(', ') },
          { label: '검증일', value: lastChecked },
        ]}
        limit={3}
      />
    </div>
  )
}

function ManualCard({ manual }: { manual: LlmCliManual }) {
  const relatedCommands = manual.commandIds
    .map((commandId) => commandById.get(commandId))
    .filter((command): command is VibeCodingCommand => Boolean(command))
  const providerLabels = manual.providerIds.map(
    (providerId) => getProviderLabel(providerId) ?? providerId
  )

  return (
    <article className="min-w-0 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip
              tone={manual.level === '고급' ? 'amber' : manual.level === '실무' ? 'blue' : 'accent'}
            >
              {manual.level}
            </Chip>
            <span className="text-xs font-semibold text-text-subtle">
              {providerLabels.slice(0, 5).join(' · ')}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold text-text">{manual.title}</h3>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-text-muted">{manual.summary}</p>
        </div>
        <Chip tone="neutral">{manual.commandIds.length}개 명령 연결</Chip>
      </div>

      <div className="mt-5 grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        <div className="min-w-0 space-y-5">
          <div className="rounded-md border border-border bg-bg p-4">
            <p className="text-xs font-semibold text-text-subtle">전체 흐름</p>
            <p className="mt-2 text-sm leading-6 text-text-muted">{manual.overview}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-text">절차</h4>
            <ol className="mt-3 space-y-3">
              {manual.steps.map((step, index) => (
                <li
                  key={`${manual.id}-${step.title}`}
                  className="min-w-0 rounded-md border border-border bg-bg p-3"
                >
                  <div className="flex gap-3">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md border border-border bg-surface text-xs font-bold text-accent">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-text">{step.title}</p>
                      <p className="mt-1 text-xs leading-5 text-text-muted">{step.body}</p>
                      {step.commands?.length ? (
                        <div className="mt-3 space-y-2">
                          {step.commands.map((command) => (
                            <CommandRow key={command} label="예시 명령" value={command} />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-accent" aria-hidden />
              <h4 className="text-sm font-semibold text-text">프롬프트 템플릿</h4>
            </div>
            <pre className="min-w-0 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg p-3 font-mono text-xs leading-5 text-text">
              <code>{manual.promptTemplate}</code>
            </pre>
          </div>
        </div>

        <aside className="min-w-0 space-y-5">
          <TextList title="시작 전 준비" items={manual.prerequisites} />
          <TextList title="검증 체크" items={manual.verification} />
          <TextList title="문제 해결" items={manual.troubleshooting} />
          <div className="rounded-md border border-accent-3/30 bg-accent-3/10 p-3">
            <TextList title="보안 체크" items={manual.securityChecklist} />
          </div>

          {relatedCommands.length ? (
            <div>
              <p className="text-xs font-semibold text-text-subtle">연결 명령어</p>
              <div className="mt-2 space-y-2">
                {relatedCommands.slice(0, 6).map((command) => (
                  <div
                    key={command.id}
                    className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-bg p-2"
                  >
                    <BrandMark
                      providerId={command.providerId}
                      label={command.modelName}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-text">
                        {command.modelName}
                      </p>
                      <p className="text-[0.6875rem] text-text-subtle">
                        {command.surface} · {command.vibeCodingFit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <ManualSourceLinks manual={manual} />
        </aside>
      </div>
    </article>
  )
}

export function LlmCliManualSection({ manuals = llmCliManuals }: { manuals?: LlmCliManual[] }) {
  const [levels, setLevels] = useState<ActiveManualLevelFilter[]>([])
  const [providers, setProviders] = useState<ProviderId[]>([])
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<ManualSortMode>('recommended')
  const [visibleLimitState, setVisibleLimitState] = useState({
    key: '',
    limit: initialManualVisibleCount,
  })

  const filteredManuals = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase('ko-KR').trim()

    return manuals
      .filter((manual) => {
        const searchable = [
          manual.title,
          manual.level,
          manual.summary,
          manual.overview,
          manual.promptTemplate,
          ...manual.prerequisites,
          ...manual.steps.flatMap((step) => [step.title, step.body, ...(step.commands ?? [])]),
          ...manual.verification,
          ...manual.troubleshooting,
          ...manual.securityChecklist,
          ...manual.tags,
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR')

        return (
          (levels.length === 0 || levels.includes(manual.level)) &&
          (providers.length === 0 ||
            providers.some((providerId) => manual.providerIds.includes(providerId))) &&
          (!normalizedQuery || searchable.includes(normalizedQuery))
        )
      })
      .toSorted((left, right) => {
        switch (sortMode) {
          case 'level': {
            const byLevel = manualLevelOrderMap[left.level] - manualLevelOrderMap[right.level]
            if (byLevel !== 0) return byLevel
            return left.title.localeCompare(right.title)
          }
          case 'title':
            return left.title.localeCompare(right.title)
          case 'source': {
            const bySource = right.sourceIds.length - left.sourceIds.length
            if (bySource !== 0) return bySource
            return left.title.localeCompare(right.title)
          }
          case 'recommended':
          default:
            return getRecommendedManualRank(left.id) - getRecommendedManualRank(right.id)
        }
      })
  }, [levels, manuals, providers, query, sortMode])

  const visibleFilterKey = [
    levels.join('|'),
    providers.join('|'),
    query.trim(),
    sortMode,
    manuals.map((manual) => manual.id).join('|'),
  ].join('::')
  const visibleLimit =
    visibleLimitState.key === visibleFilterKey ? visibleLimitState.limit : initialManualVisibleCount
  const visibleManuals = filteredManuals.slice(0, visibleLimit)
  const hasMoreManuals = visibleManuals.length < filteredManuals.length
  const setVisibleLimitForCurrentFilter = (limit: number) => {
    setVisibleLimitState({ key: visibleFilterKey, limit })
  }
  const hasActiveFilter = levels.length > 0 || providers.length > 0 || query.trim() !== ''
  const resetFilters = () => {
    setLevels([])
    setProviders([])
    setQuery('')
    setSortMode('recommended')
  }

  return (
    <section id="cli-manual" className="scroll-mt-32 space-y-4">
      <SectionHeader
        icon={BookOpenCheck}
        title="LLM CLI 실전 매뉴얼"
        description="설치·인증부터 repo 수정, OpenAI 호환 API, MCP/권한, 팀 운영까지 LLM CLI를 실제 업무에 붙이는 절차를 한곳에서 확인합니다."
        badge={<Chip tone="accent">{manuals.length}개 매뉴얼</Chip>}
      />

      <ManualOverviewPanel manuals={manuals} />

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1.1fr_1.1fr_1fr_10rem]">
        <MultiSegmentBar
          label="난이도"
          items={manualLevelFilters}
          value={levels}
          onChange={setLevels}
        />
        <MultiSegmentBar
          label="제공사"
          items={manualProviderItems}
          value={providers}
          onChange={setProviders}
        />
        <SearchField
          label="매뉴얼 검색"
          value={query}
          onChange={setQuery}
          placeholder="Aider, 보안, 팀 도입, base URL"
        />
        <SortSelect
          label="정렬"
          value={sortMode}
          onChange={setSortMode}
          options={manualSortOptions}
        />
      </div>

      <ResultSummary
        shown={filteredManuals.length}
        total={manuals.length}
        onReset={resetFilters}
        resetDisabled={!hasActiveFilter && sortMode === 'recommended'}
      />

      {filteredManuals.length ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-xs text-text-subtle">
            <span>
              현재 <span className="font-semibold text-text">{visibleManuals.length}</span>개 표시 ·
              필터 결과 {filteredManuals.length}개
            </span>
            <span>긴 매뉴얼은 필터와 더 보기로 단계적으로 확인합니다.</span>
          </div>
          <div className="space-y-4">
            {visibleManuals.map((manual) => (
              <ManualCard key={manual.id} manual={manual} />
            ))}
          </div>
          {hasMoreManuals || filteredManuals.length > initialManualVisibleCount ? (
            <div className="flex justify-center">
              {hasMoreManuals ? (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleLimitForCurrentFilter(
                      Math.min(filteredManuals.length, visibleLimit + initialManualVisibleCount)
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
                >
                  <ChevronDown className="size-3.5" aria-hidden />더 보기 ·{' '}
                  {filteredManuals.length - visibleManuals.length}개 남음
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setVisibleLimitForCurrentFilter(initialManualVisibleCount)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-border-strong hover:text-text"
                >
                  처음 {initialManualVisibleCount}개만 보기
                </button>
              )}
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState
          title="조건에 맞는 LLM CLI 매뉴얼이 없습니다"
          body="난이도와 제공사 필터를 전체로 바꾸거나 검색어를 줄이면 매뉴얼이 다시 표시됩니다."
        />
      )}
    </section>
  )
}

export function CliComparisonSection({
  commands = vibeCodingCommands,
}: {
  commands?: VibeCodingCommand[]
}) {
  const [surface, setSurface] = useState<SurfaceFilter>('all')
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('fit')

  const filteredCommands = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase('ko-KR').trim()

    return commands
      .filter((command) => {
        if (surface !== 'all' && command.surface !== surface) return false
        if (!normalizedQuery) return true
        const searchable = [
          command.modelName,
          command.command,
          command.installCommand,
          command.useCase,
          ...command.setupNotes,
          ...command.caveats,
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR')
        return searchable.includes(normalizedQuery)
      })
      .toSorted((left, right) => {
        switch (sortMode) {
          case 'fit': {
            const byFit = fitOrderMap[right.vibeCodingFit] - fitOrderMap[left.vibeCodingFit]
            if (byFit !== 0) return byFit
            return left.modelName.localeCompare(right.modelName)
          }
          case 'model':
            return left.modelName.localeCompare(right.modelName)
          case 'provider':
            return (getProviderLabel(left.providerId) ?? '').localeCompare(
              getProviderLabel(right.providerId) ?? ''
            )
          default:
            return 0
        }
      })
  }, [commands, surface, sortMode, query])

  const hasActiveFilter = surface !== 'all' || query.trim() !== ''
  const resetFilters = () => {
    setSurface('all')
    setQuery('')
    setSortMode('fit')
  }

  return (
    <section id="cli-comparison" className="scroll-mt-32 space-y-4">
      <SectionHeader
        icon={Terminal}
        title="LLM CLI 명령어 비교표"
        description="모델별 CLI·에이전트의 설치·실행 명령어와 바이브 코딩 적합도를 나란히 비교하고, 셋업·운영 주의점을 빠르게 훑습니다."
        badge={<Chip tone="accent">{commands.length}개</Chip>}
      />

      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1.6fr_1fr_10rem]">
        <SegmentBar
          label="실행 표면"
          items={surfaceFilters}
          value={surface}
          onChange={setSurface}
        />
        <SearchField
          label="명령어 검색"
          value={query}
          onChange={setQuery}
          placeholder="claude, codex, 설치, 리뷰"
        />
        <SortSelect label="정렬" value={sortMode} onChange={setSortMode} options={sortOptions} />
      </div>

      <ResultSummary
        shown={filteredCommands.length}
        total={commands.length}
        onReset={resetFilters}
        resetDisabled={!hasActiveFilter && sortMode === 'fit'}
      />

      {filteredCommands.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredCommands.map((command) => (
            <CommandCard key={command.id} command={command} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 CLI 명령어가 없습니다"
          body="실행 표면을 전체로 바꾸거나 검색어를 줄이면 명령어가 다시 표시됩니다."
        />
      )}
    </section>
  )
}
