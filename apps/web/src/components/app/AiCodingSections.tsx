import {
  getAiCodingToolCategoryLabel,
  getBenchmarkDomainLabel,
  getContentMetadataSearchText,
  getModelById,
  getProviderLabel,
  getSources,
  getSourceMetadata,
  getTaskRecommendationCategoryLabel,
  learningResources,
  vibeCodingCommands,
  type AiCodingToolCategory,
  type AiCodingToolProfile,
  type LearningResource,
  type ModelProfile,
  type TaskRecommendation,
  type TaskRecommendationCategory,
  type VibeCodingCommand,
} from '@aidigestdesk/content'
import { Boxes, Code2, ExternalLink, Search, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'

import {
  EmptyState,
  MetadataChips,
  MultiSegmentBar,
  SectionHeader,
  SegmentBar,
  TextList,
} from '@/components/app/CommonUi'

type VibeSurfaceFilter = VibeCodingCommand['surface'] | 'all'
type VibeFitFilter = VibeCodingCommand['vibeCodingFit'] | 'all'
type VibeSortMode = 'fit' | 'model' | 'surface' | 'provider'
type VibeSortDirection = 'asc' | 'desc'
type AiCodingToolCategoryFilter = AiCodingToolCategory | 'all'
type AiCodingToolPricingFilter = 'all' | 'free' | 'student' | 'trial' | 'enterprise' | 'openSource'
type TaskRecommendationCategoryFilter = TaskRecommendationCategory | 'all'
type TaskRecommendationSortMode =
  | 'title'
  | 'category'
  | 'intent'
  | 'primaryCount'
  | 'alternateCount'
  | 'commandCount'
  | 'resourceCount'
type TaskRecommendationSortDirection = 'asc' | 'desc'
type AiCodingToolSortMode =
  | 'name'
  | 'vendor'
  | 'category'
  | 'provider'
  | 'pricing'
  | 'integration'
  | 'koreanResource'
  | 'source'
type AiCodingToolSortDirection = 'asc' | 'desc'
type ActiveVibeSurfaceFilter = Exclude<VibeSurfaceFilter, 'all'>
type ActiveVibeFitFilter = Exclude<VibeFitFilter, 'all'>
type ActiveAiCodingToolCategoryFilter = Exclude<AiCodingToolCategoryFilter, 'all'>
type ActiveAiCodingToolPricingFilter = Exclude<AiCodingToolPricingFilter, 'all'>
type ActiveTaskRecommendationCategoryFilter = Exclude<TaskRecommendationCategoryFilter, 'all'>

export function TaskRecommendationSection({
  recommendations,
}: {
  recommendations: TaskRecommendation[]
}) {
  const [categories, setCategories] = useState<ActiveTaskRecommendationCategoryFilter[]>([])
  const [intentQuery, setIntentQuery] = useState('')
  const [sortMode, setSortMode] = useState<TaskRecommendationSortMode>('title')
  const [sortDirection, setSortDirection] = useState<TaskRecommendationSortDirection>('asc')
  const categoryItems: Array<{
    id: TaskRecommendationCategoryFilter
    label: string
  }> = ['all', 'coding', 'ppt', 'research', 'automation', 'cost', 'learning', 'security'].map(
    (id) => ({
      id: id as TaskRecommendationCategoryFilter,
      label: getTaskRecommendationCategoryLabel(id as TaskRecommendationCategoryFilter),
    })
  )
  const sortFilters: Array<{ id: TaskRecommendationSortMode; label: string }> = [
    { id: 'title', label: '제목' },
    { id: 'category', label: '카테고리' },
    { id: 'intent', label: '작업 의도' },
    { id: 'primaryCount', label: '우선 추천 수' },
    { id: 'alternateCount', label: '대체 후보 수' },
    { id: 'commandCount', label: '명령어 수' },
    { id: 'resourceCount', label: '자료 수' },
  ]
  const sortDirectionFilters: Array<{
    id: TaskRecommendationSortDirection
    label: string
  }> = [
    { id: 'asc', label: '오름차순' },
    { id: 'desc', label: '내림차순' },
  ]
  const visibleRecommendations = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    const normalizedQuery = intentQuery.toLocaleLowerCase('ko-KR').trim()

    return recommendations
      .filter(
        (recommendation) =>
          (categories.length === 0 || categories.includes(recommendation.category)) &&
          (!normalizedQuery ||
            [
              recommendation.title,
              recommendation.userIntent,
              recommendation.promptStarter,
              ...recommendation.rationale,
              ...recommendation.tradeoffs,
            ]
              .join(' ')
              .toLocaleLowerCase('ko-KR')
              .includes(normalizedQuery))
      )
      .toSorted((left, right) => {
        switch (sortMode) {
          case 'title':
            return left.title.localeCompare(right.title) * direction
          case 'category':
            return left.category.localeCompare(right.category) * direction
          case 'intent':
            return left.userIntent.localeCompare(right.userIntent) * direction
          case 'primaryCount': {
            const leftPrimaryCount = left.primaryModelIds.length
            const rightPrimaryCount = right.primaryModelIds.length
            if (leftPrimaryCount === rightPrimaryCount) return 0
            return (leftPrimaryCount - rightPrimaryCount) * direction
          }
          case 'alternateCount': {
            const leftAlternateCount = left.alternateModelIds.length
            const rightAlternateCount = right.alternateModelIds.length
            if (leftAlternateCount === rightAlternateCount) return 0
            return (leftAlternateCount - rightAlternateCount) * direction
          }
          case 'commandCount': {
            const leftCommandCount = left.commandIds.length
            const rightCommandCount = right.commandIds.length
            if (leftCommandCount === rightCommandCount) return 0
            return (leftCommandCount - rightCommandCount) * direction
          }
          case 'resourceCount': {
            const leftResourceCount = left.resourceIds.length
            const rightResourceCount = right.resourceIds.length
            if (leftResourceCount === rightResourceCount) return 0
            return (leftResourceCount - rightResourceCount) * direction
          }
          default:
            return 0
        }
      })
  }, [categories, intentQuery, recommendations, sortDirection, sortMode])

  return (
    <section id="task-recommendations" className="space-y-4">
      <SectionHeader
        icon={Sparkles}
        title="작업별 LLM·도구 추천"
        description="사용자가 하려는 일을 먼저 고르고, 추천 모델·대체 모델·CLI/IDE 명령어·학습 자료를 한 번에 비교합니다."
      />
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1.4fr_1fr_8rem]">
        <MultiSegmentBar
          label="작업 유형"
          items={categoryItems}
          value={categories}
          onChange={setCategories}
        />
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="text-xs font-semibold text-text-subtle">정렬</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <div className="min-w-0 flex-1">
              <SegmentBar
                label="정렬"
                items={sortFilters}
                value={sortMode}
                onChange={setSortMode}
              />
            </div>
            <div className="min-w-0 flex-1">
              <SegmentBar
                label="정렬 방향"
                items={sortDirectionFilters}
                value={sortDirection}
                onChange={setSortDirection}
              />
            </div>
          </div>
        </div>
        <label className="block">
          <span className="text-xs font-semibold text-text-subtle">하고 싶은 작업 검색</span>
          <input
            value={intentQuery}
            onChange={(event) => setIntentQuery(event.target.value)}
            placeholder="버그 수정, PPT, 최신 뉴스, 비용, 보안"
            className="mt-2 h-10 w-full rounded-md border border-border bg-bg px-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus:border-accent"
          />
        </label>
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="text-xs font-semibold text-text-subtle">추천 결과</p>
          <p className="mt-1 text-lg font-semibold text-text">{visibleRecommendations.length}개</p>
        </div>
      </div>

      {visibleRecommendations.length ? (
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {visibleRecommendations.map((recommendation) => {
            const primaryModels = recommendation.primaryModelIds
              .map(getModelById)
              .filter((model): model is ModelProfile => Boolean(model))
            const alternateModels = recommendation.alternateModelIds
              .map(getModelById)
              .filter((model): model is ModelProfile => Boolean(model))
            const commands = recommendation.commandIds
              .map((id) => vibeCodingCommands.find((command) => command.id === id))
              .filter((command): command is VibeCodingCommand => Boolean(command))
            const relatedResources = recommendation.resourceIds
              .map((id) => learningResources.find((resource) => resource.id === id))
              .filter((resource): resource is LearningResource => Boolean(resource))

            return (
              <article
                key={recommendation.id}
                className="min-w-0 rounded-lg border border-border bg-surface p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-accent">
                      {getTaskRecommendationCategoryLabel(recommendation.category)}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-text">
                      {recommendation.title}
                    </h3>
                  </div>
                  <span className="max-w-full rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-subtle">
                    {recommendation.benchmarkDomains.map(getBenchmarkDomainLabel).join(' · ')}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  {recommendation.userIntent}
                </p>

                <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-subtle">우선 추천</p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                      {primaryModels.map((model) => (
                        <span
                          key={model.id}
                          className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text"
                        >
                          {model.modelName}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-subtle">대체 후보</p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                      {alternateModels.map((model) => (
                        <span
                          key={model.id}
                          className="rounded-md border border-dashed border-border-strong px-2.5 py-1.5 text-xs font-semibold text-text-subtle"
                        >
                          {model.modelName}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2">
                  <TextList title="추천 이유" items={recommendation.rationale} />
                  <TextList title="주의할 점" items={recommendation.tradeoffs} />
                </div>

                <div className="mt-4">
                  <p className="mb-1 text-xs font-semibold text-text-subtle">바로 넣을 프롬프트</p>
                  <pre className="min-w-0 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-border bg-bg p-3 text-xs leading-5 text-text">
                    <code>{recommendation.promptStarter}</code>
                  </pre>
                </div>

                <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-subtle">연결 명령어</p>
                    <div className="mt-2 space-y-2">
                      {commands.map((command) => (
                        <div key={command.id} className="rounded-md border border-border bg-bg p-3">
                          <p className="text-xs font-semibold text-text">{command.modelName}</p>
                          <p className="mt-1 text-xs text-text-subtle">
                            {command.surface} · {command.vibeCodingFit}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-subtle">관련 자료</p>
                    <div className="mt-2 flex min-w-0 flex-wrap gap-2">
                      {relatedResources.map((resource) => (
                        <a
                          key={resource.id}
                          href={resource.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
                        >
                          {resource.title}
                          <ExternalLink className="size-3" aria-hidden />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 추천이 없습니다"
          body="작업 유형을 전체로 바꾸거나 검색어를 줄이면 추천이 다시 표시됩니다."
        />
      )}
    </section>
  )
}

function matchesToolPricing(tool: AiCodingToolProfile, pricingMode: AiCodingToolPricingFilter) {
  if (pricingMode === 'all') return true

  const combined = [tool.pricing, tool.eventSignal, ...tool.tags, ...tool.caveats]
    .join(' ')
    .toLocaleLowerCase('ko-KR')

  switch (pricingMode) {
    case 'free':
      return /무료|free|basic|community/.test(combined)
    case 'student':
      return /학생|student|education|edu|교육/.test(combined)
    case 'trial':
      return /체험|trial|preview|베타/.test(combined)
    case 'enterprise':
      return /enterprise|team|business|pro\+|엔터프라이즈|팀/.test(combined)
    case 'openSource':
      return /오픈소스|open-source|self-host|로컬|자체/.test(combined)
  }
}

export function CodingToolDirectorySection({ tools }: { tools: AiCodingToolProfile[] }) {
  const [categories, setCategories] = useState<ActiveAiCodingToolCategoryFilter[]>([])
  const [pricingModes, setPricingModes] = useState<ActiveAiCodingToolPricingFilter[]>([])
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<AiCodingToolSortMode>('name')
  const [sortDirection, setSortDirection] = useState<AiCodingToolSortDirection>('asc')

  const toolCategoryFilters: Array<{
    id: AiCodingToolCategoryFilter
    label: string
  }> = [
    'all',
    'AI IDE',
    'IDE 확장',
    'CLI/터미널',
    'PR 리뷰',
    '웹앱 제작',
    '클라우드 에이전트',
    '오픈소스 스택',
  ].map((id) => ({
    id: id as AiCodingToolCategoryFilter,
    label: getAiCodingToolCategoryLabel(id as AiCodingToolCategoryFilter),
  }))
  const pricingFilters: Array<{
    id: AiCodingToolPricingFilter
    label: string
  }> = [
    { id: 'all', label: '전체' },
    { id: 'free', label: '무료/프리' },
    { id: 'student', label: '학생' },
    { id: 'trial', label: '체험' },
    { id: 'enterprise', label: '팀/엔터프라이즈' },
    { id: 'openSource', label: '오픈소스/자체' },
  ]
  const sortFilters: Array<{ id: AiCodingToolSortMode; label: string }> = [
    { id: 'name', label: '도구명' },
    { id: 'vendor', label: '벤더' },
    { id: 'category', label: '유형' },
    { id: 'provider', label: '제공사' },
    { id: 'pricing', label: '가격/혜택' },
    { id: 'integration', label: '연동 항목 수' },
    { id: 'koreanResource', label: '한국어 자료 수' },
    { id: 'source', label: '출처 수' },
  ]
  const sortDirectionFilters: Array<{
    id: AiCodingToolSortDirection
    label: string
  }> = [
    { id: 'asc', label: '오름차순' },
    { id: 'desc', label: '내림차순' },
  ]

  const filteredTools = useMemo(() => {
    const normalizedQuery = query.toLocaleLowerCase('ko-KR').trim()
    const direction = sortDirection === 'asc' ? 1 : -1

    return tools
      .filter((tool) => {
        const toolSources = getSources(tool.sourceIds)
        const searchable = [
          tool.toolName,
          tool.vendor,
          tool.category,
          tool.pricing,
          tool.eventSignal,
          ...tool.bestFor,
          ...tool.integrations,
          ...tool.koreanResources,
          ...tool.caveats,
          ...tool.tags,
          ...toolSources.map((source) => getContentMetadataSearchText(getSourceMetadata(source))),
        ]
          .join(' ')
          .toLocaleLowerCase('ko-KR')

        return (
          (categories.length === 0 || categories.includes(tool.category)) &&
          (pricingModes.length === 0 ||
            pricingModes.some((pricingMode) => matchesToolPricing(tool, pricingMode))) &&
          (!normalizedQuery || searchable.includes(normalizedQuery))
        )
      })
      .toSorted((left, right) => {
        switch (sortMode) {
          case 'name':
            return left.toolName.localeCompare(right.toolName) * direction
          case 'vendor':
            return left.vendor.localeCompare(right.vendor) * direction
          case 'category':
            return left.category.localeCompare(right.category) * direction
          case 'provider': {
            const leftProvider = left.providerIds?.length
              ? left.providerIds.map(getProviderLabel).join(' · ')
              : '도구 독립'
            const rightProvider = right.providerIds?.length
              ? right.providerIds.map(getProviderLabel).join(' · ')
              : '도구 독립'
            if (leftProvider === rightProvider) return 0
            return leftProvider.localeCompare(rightProvider) * direction
          }
          case 'pricing':
            return left.pricing.localeCompare(right.pricing) * direction
          case 'integration': {
            const leftCount = left.integrations.length
            const rightCount = right.integrations.length
            if (leftCount === rightCount) return 0
            return (leftCount - rightCount) * direction
          }
          case 'koreanResource': {
            const leftCount = left.koreanResources.length
            const rightCount = right.koreanResources.length
            if (leftCount === rightCount) return 0
            return (leftCount - rightCount) * direction
          }
          case 'source': {
            const leftCount = left.sourceIds.length
            const rightCount = right.sourceIds.length
            if (leftCount === rightCount) return 0
            return (leftCount - rightCount) * direction
          }
          default:
            return 0
        }
      })
  }, [categories, pricingModes, query, sortDirection, sortMode, tools])

  return (
    <section id="ai-tools" className="space-y-4">
      <SectionHeader
        icon={Boxes}
        title="AI 코딩 도구 디렉터리"
        description="Cursor, Copilot, Junie, Amazon Q, Gemini Code Assist, Jules, Amp, Zed, Augment, Tabnine, CodeRabbit, TRAE와 오픈소스 스택을 도구 관점으로 비교합니다."
      />
      <div className="grid gap-4 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1fr_1fr_18rem]">
        <MultiSegmentBar
          label="도구 유형"
          items={toolCategoryFilters}
          value={categories}
          onChange={setCategories}
        />
        <MultiSegmentBar
          label="가격/혜택"
          items={pricingFilters}
          value={pricingModes}
          onChange={setPricingModes}
        />
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="text-xs font-semibold text-text-subtle">정렬</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <SegmentBar
              label="정렬 항목"
              items={sortFilters}
              value={sortMode}
              onChange={setSortMode}
            />
            <SegmentBar
              label="정렬 방향"
              items={sortDirectionFilters}
              value={sortDirection}
              onChange={setSortDirection}
            />
          </div>
        </div>
        <label className="block min-w-0">
          <span className="text-xs font-semibold text-text-subtle">도구 검색</span>
          <div className="mt-2 flex h-10 items-center gap-2 rounded-md border border-border bg-bg px-3">
            <Search className="size-4 shrink-0 text-text-subtle" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cursor, 학생, PR 리뷰"
              className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
            />
          </div>
        </label>
      </div>

      {filteredTools.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredTools.map((tool) => {
            const toolSources = getSources(tool.sourceIds).slice(0, 4)
            const toolSourceMetadata = toolSources.map(getSourceMetadata)
            const toolSourceDomains = [
              ...new Set(toolSourceMetadata.flatMap((metadata) => metadata.sourceDomains ?? [])),
            ]
            const toolLastChecked = toolSources
              .map((source) => source.lastChecked)
              .toSorted((left, right) => right.localeCompare(left))[0]
            return (
              <article key={tool.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-accent">
                      {tool.vendor} · {tool.category}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-text">{tool.toolName}</h3>
                  </div>
                  <span className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-subtle">
                    {tool.providerIds?.length
                      ? tool.providerIds.map(getProviderLabel).join(' · ')
                      : '도구 독립'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border border-border bg-bg p-3">
                    <p className="text-xs font-semibold text-text-subtle">가격/플랜</p>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{tool.pricing}</p>
                  </div>
                  <div className="rounded-md border border-border bg-bg p-3">
                    <p className="text-xs font-semibold text-text-subtle">이벤트/혜택 신호</p>
                    <p className="mt-1 text-sm leading-6 text-text-muted">{tool.eventSignal}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <TextList title="추천 업무" items={tool.bestFor} />
                  <TextList title="연동" items={tool.integrations} />
                  <TextList title="주의점" items={tool.caveats} />
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-text-subtle">한국어 자료/검색 허브</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {tool.koreanResources.map((resource) => (
                      <span
                        key={resource}
                        className="rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted"
                      >
                        {resource}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {toolSources.map((source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
                    >
                      {source.publisher}
                      <ExternalLink className="size-3" aria-hidden />
                    </a>
                  ))}
                </div>
                <MetadataChips
                  items={[
                    {
                      label: '뉴스 출처',
                      value: toolSources.map((source) => source.publisher).join(', '),
                    },
                    { label: '도메인', value: toolSourceDomains.slice(0, 3).join(', ') },
                    { label: '수집일', value: toolLastChecked },
                    { label: '검증일', value: toolLastChecked },
                  ]}
                  limit={4}
                />
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 AI 코딩 도구가 없습니다"
          body="도구 유형, 가격/혜택, 검색어를 전체 기준으로 바꾸면 다시 표시됩니다."
        />
      )}
    </section>
  )
}

function fitClass(fit: VibeCodingCommand['vibeCodingFit']) {
  switch (fit) {
    case '매우 높음':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
    case '높음':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300'
    case '보통':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300'
    default:
      return 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'
  }
}

const vibeFitOrder: Record<VibeCodingCommand['vibeCodingFit'], number> = {
  '매우 높음': 3,
  높음: 2,
  보통: 1,
  제한적: 0,
}

export function VibeCodingSection({ commands }: { commands: VibeCodingCommand[] }) {
  const [surfaces, setSurfaces] = useState<ActiveVibeSurfaceFilter[]>([])
  const [fits, setFits] = useState<ActiveVibeFitFilter[]>([])
  const [sortMode, setSortMode] = useState<VibeSortMode>('fit')
  const [sortDirection, setSortDirection] = useState<VibeSortDirection>('desc')
  const surfaceFilters: Array<{ id: VibeSurfaceFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: '전용 CLI', label: '전용 CLI' },
    { id: 'IDE/에이전트', label: 'IDE/에이전트' },
    { id: 'OpenAI 호환 API', label: '호환 API' },
    { id: '공식 SDK', label: '공식 SDK' },
    { id: '서드파티 CLI', label: '서드파티 CLI' },
    { id: '웹/에이전트', label: '웹/에이전트' },
  ]
  const fitFilters: Array<{ id: VibeFitFilter; label: string }> = [
    { id: 'all', label: '전체' },
    { id: '매우 높음', label: '매우 높음' },
    { id: '높음', label: '높음' },
    { id: '보통', label: '보통' },
    { id: '제한적', label: '제한적' },
  ]
  const sortFilters: Array<{ id: VibeSortMode; label: string }> = [
    { id: 'fit', label: '적합도' },
    { id: 'model', label: '모델명' },
    { id: 'surface', label: '실행 표면' },
    { id: 'provider', label: '제공사' },
  ]
  const sortDirectionFilters: Array<{
    id: VibeSortDirection
    label: string
  }> = [
    { id: 'asc', label: '오름차순' },
    { id: 'desc', label: '내림차순' },
  ]
  const commandGoal = (command: VibeCodingCommand) =>
    command.goal?.trim() ??
    (command.useCase?.trim() || '요청한 목표 달성을 위한 코드베이스 작업형 프롬프트를 실행합니다.')
  const commandLoop = (command: VibeCodingCommand) =>
    command.loop?.trim() ?? '요구 파악 → 실행 명령 전달 → 변경 제안 생성 → 검증/리뷰 → 반복 개선'

  const filteredCommands = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    return commands
      .filter(
        (command) =>
          (surfaces.length === 0 || surfaces.includes(command.surface)) &&
          (fits.length === 0 || fits.includes(command.vibeCodingFit))
      )
      .toSorted((a, b) => {
        switch (sortMode) {
          case 'fit': {
            const byFit =
              (vibeFitOrder[a.vibeCodingFit] ?? 0) - (vibeFitOrder[b.vibeCodingFit] ?? 0)
            if (byFit !== 0) return byFit * direction
            return a.modelName.localeCompare(b.modelName) * direction
          }
          case 'model':
            return a.modelName.localeCompare(b.modelName) * direction
          case 'surface':
            if (a.surface === b.surface) return 0
            return a.surface.localeCompare(b.surface) * direction
          case 'provider':
            return (
              (getProviderLabel(a.providerId) ?? '미지정').localeCompare(
                getProviderLabel(b.providerId) ?? '미지정'
              ) * direction
            )
          default:
            return 0
        }
      })
  }, [commands, fits, surfaces, sortDirection, sortMode])

  return (
    <section id="vibe-coding" className="space-y-4">
      <SectionHeader
        icon={Code2}
        title="AI 바이브 코딩 허브"
        description="전용 CLI, OpenAI 호환 API, 공식 SDK, 로컬 배포를 모델별 명령어와 운영 주의점으로 비교합니다."
      />
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 xl:grid-cols-[1.3fr_1fr_8rem]">
        <MultiSegmentBar
          label="실행 표면"
          items={surfaceFilters}
          value={surfaces}
          onChange={setSurfaces}
        />
        <MultiSegmentBar
          label="바이브 코딩 적합도"
          items={fitFilters}
          value={fits}
          onChange={setFits}
        />
        <SegmentBar label="정렬" items={sortFilters} value={sortMode} onChange={setSortMode} />
        <SegmentBar
          label="정렬 방향"
          items={sortDirectionFilters}
          value={sortDirection}
          onChange={setSortDirection}
        />
        <div className="rounded-md border border-border bg-bg p-3">
          <p className="text-xs font-semibold text-text-subtle">필터 결과</p>
          <p className="mt-1 text-lg font-semibold text-text">{filteredCommands.length}개</p>
        </div>
      </div>
      {filteredCommands.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredCommands.map((command) => {
            const commandSources = getSources(command.sourceIds)
            const officialSources = commandSources.filter((source) => source.kind === 'official')
            const renderedSources =
              officialSources.length > 0
                ? [
                    ...officialSources,
                    ...commandSources.filter((source) => source.kind !== 'official'),
                  ]
                : commandSources
            const commandSourceMetadata = renderedSources.map(getSourceMetadata)
            const commandSourceDomains = [
              ...new Set(commandSourceMetadata.flatMap((metadata) => metadata.sourceDomains ?? [])),
            ]
            const commandLastChecked = renderedSources
              .map((source) => source.lastChecked)
              .toSorted((left, right) => right.localeCompare(left))[0]

            return (
              <article key={command.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-accent">
                      {getProviderLabel(command.providerId)} · {command.surface}
                    </p>
                    <h3 className="mt-1 text-base font-semibold text-text">{command.modelName}</h3>
                  </div>
                  <span
                    className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${fitClass(
                      command.vibeCodingFit
                    )}`}
                  >
                    {command.vibeCodingFit}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-muted">{command.useCase}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-text-subtle">목표</p>
                    <p className="rounded-md border border-border bg-bg p-3 text-xs leading-5 text-text-muted">
                      {commandGoal(command)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-text-subtle">작업 루프</p>
                    <p className="rounded-md border border-border bg-bg p-3 text-xs leading-5 text-text-muted">
                      {commandLoop(command)}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <p className="mb-1 text-xs font-semibold text-text-subtle">매뉴얼/설명 링크</p>
                  <div className="flex flex-wrap gap-2">
                    {renderedSources.slice(0, 6).map((source) => (
                      <a
                        key={source.id}
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg px-2.5 py-1.5 text-xs font-semibold text-text-muted transition hover:text-text"
                      >
                        {source.title}
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    ))}
                  </div>
                  <MetadataChips
                    items={[
                      {
                        label: '출처',
                        value: renderedSources
                          .slice(0, 3)
                          .map((source) => source.publisher)
                          .join(', '),
                      },
                      { label: '도메인', value: commandSourceDomains.slice(0, 3).join(', ') },
                      { label: '수집일', value: commandLastChecked },
                      { label: '검증일', value: commandLastChecked },
                    ]}
                    limit={4}
                  />
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-text-subtle">설치/준비</p>
                    <pre className="min-h-24 overflow-x-auto rounded-md border border-border bg-bg p-3 text-xs leading-5 text-text">
                      <code>{command.installCommand}</code>
                    </pre>
                  </div>
                  <div className="min-w-0">
                    <p className="mb-1 text-xs font-semibold text-text-subtle">실행 예시</p>
                    <pre className="min-h-24 overflow-x-auto rounded-md border border-border bg-bg p-3 text-xs leading-5 text-text">
                      <code>{command.command}</code>
                    </pre>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <TextList title="셋업 포인트" items={command.setupNotes} />
                  <TextList title="주의점" items={command.caveats} />
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState
          title="조건에 맞는 바이브 코딩 명령어가 없습니다"
          body="실행 표면이나 적합도 필터를 전체로 바꾸면 명령어가 다시 표시됩니다."
        />
      )}
    </section>
  )
}
